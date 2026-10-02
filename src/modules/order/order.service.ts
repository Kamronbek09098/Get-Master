import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderActor, OrderStatus, PaymentProvider, Prisma, WorkStage } from '@prisma/client';
import { MasterStatsService } from '../master/master-stats.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { assertTransition } from './order-state-machine';
import { CreateWorkProofDto } from './dto/create-work-proof.dto';
import { OrderHistoryQueryDto } from './dto/order-history-query.dto';
import { ProposeRescheduleDto } from './dto/propose-reschedule.dto';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { ReasonDto } from './dto/reason.dto';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { ERRORS } from '../../common/constants/error-messages';
import { RescheduleNotAllowedException, RescheduleNotPendingException, RescheduleOwnProposalException, WorkTooEarlyException } from '../../common/exceptions/business.exception';
import { formatUzDateTime } from '../../common/utils/format-date';
import type { Panel } from '../../common/utils/panel';

const MAX_WORK_PROOFS_PER_STAGE = 10;
/** Ish hali boshlanmagan bosqichlarda — mijoz va usta kelishib vaqtni o'zgartirishi mumkin. */
const RESCHEDULABLE_STATUSES: OrderStatus[] = ['BOOKED', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED'];

const HISTORY_SELECT = {
  id: true,
  status: true,
  originalAmount: true,
  additionalAmount: true,
  finalAmount: true,
  currency: true,
  startedAt: true,
  completedAt: true,
  confirmedAt: true,
  cancelledAt: true,
  createdAt: true,
  booking: {
    select: {
      scheduledStartAt: true,
      scheduledEndAt: true,
      agreedPrice: true,
      currency: true,
      service: { select: { id: true, name: true } },
    },
  },
  customer: { select: { id: true, firstName: true, lastName: true } },
  master: { select: { id: true, user: { select: { id: true, firstName: true, lastName: true } } } },
} satisfies Prisma.OrderSelect;

const WORK_PROOF_STAGE_STATUS: Record<WorkStage, OrderStatus> = {
  BEFORE: 'ARRIVED',
  DURING: 'IN_PROGRESS',
  AFTER: 'IN_PROGRESS',
};

interface Actor {
  userId: string;
  type: OrderActor;
}

@Injectable()
export class OrderService {
  constructor(
    private readonly db: PrismaService,
    private readonly outbox: OutboxService,
    private readonly masterStats: MasterStatsService,
    private readonly metrics: MetricsService,
  ) {}

  async findOne(userId: string, orderId: string, panel: Panel | null = null) {
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      include: {
        booking: {
          select: {
            scheduledStartAt: true,
            proposedStartAt: true,
            proposedById: true,
            service: { select: { id: true, name: true } },
            request: { select: { id: true, title: true, description: true } },
          },
        },
        customer: { select: { id: true, accountNumber: true, firstName: true, lastName: true } },
        master: {
          select: {
            id: true,
            profession: true,
            user: { select: { id: true, accountNumber: true, firstName: true, lastName: true } },
          },
        },
        conversation: { select: { id: true } },
        review: { select: { rating: true, comment: true, createdAt: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, provider: true, status: true, amount: true, currency: true } },
      },
    });
    if (!order || order.customerId === order.master.user.id) throw new NotFoundException(ERRORS.ORDER_NOT_FOUND);
    const isCustomer = order.customerId === userId;
    const isMaster = order.master.user.id === userId;
    const viewerRole = this.viewerRole(isCustomer, isMaster, panel);
    if (!viewerRole) throw new ForbiddenException(ERRORS.NOT_ORDER_PARTICIPANT);
    const { booking, customer, master, conversation, payments, review, ...rest } = order;
    const orderNumber = await this.ordinalFor(order, viewerRole);
    return {
      ...rest,
      orderNumber,
      payment: payments[0] ?? null,
      // Mijoz allaqachon sharh qoldirgan bo‘lsa — shu yerda ko‘rinadi (qayta qoldirib bo‘lmaydi).
      review: review ?? null,
      viewerRole,
      service: booking.service,
      request: booking.request,
      scheduledStartAt: booking.scheduledStartAt,
      reschedule: booking.proposedStartAt
        ? { proposedStartAt: booking.proposedStartAt, proposedByMe: booking.proposedById === userId }
        : null,
      conversationId: conversation?.id ?? null,
      counterpart: viewerRole === 'MASTER' ? customer : { ...master.user, profession: master.profession },
    };
  }

  /**
   * Foydalanuvchiga ko‘rinadigan buyurtma raqami: mijoz (yoki usta) uchun uning nechanchi buyurtmasi.
   * Birinchi buyurtma — №1, ikkinchisi — №2… Umumiy (tizim) raqami faqat adminda ko‘rinadi.
   */
  private async ordinalFor(order: { id: string; customerId: string; masterId: string; createdAt: Date; orderNumber: number }, role: 'CUSTOMER' | 'MASTER' | null) {
    if (!role) return order.orderNumber;
    const party = role === 'MASTER' ? { masterId: order.masterId } : { customerId: order.customerId };
    return this.db.order.count({
      where: { ...party, OR: [{ createdAt: { lt: order.createdAt } }, { createdAt: order.createdAt, orderNumber: { lte: order.orderNumber } }] },
    });
  }

  private viewerRole(isCustomer: boolean, isMaster: boolean, panel: Panel | null): 'CUSTOMER' | 'MASTER' | null {
    if (panel === 'MASTER') return isMaster ? 'MASTER' : null;
    if (panel === 'CUSTOMER') return isCustomer ? 'CUSTOMER' : null;
    if (isCustomer) return 'CUSTOMER';
    return isMaster ? 'MASTER' : null;
  }

  async findHistory(userId: string, query: OrderHistoryQueryDto) {
    const rows = await this.db.order.findMany({
      where: {
        OR: [{ customerId: userId }, { master: { userId } }],
        status: query.status,
        ...(query.dateFrom || query.dateTo
          ? {
              createdAt: {
                ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
                ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
              },
            }
          : {}),
      },
      select: HISTORY_SELECT,
      orderBy: { createdAt: 'desc' },
      ...cursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    return { ...page, items: page.items.filter((item) => item.customer.id !== item.master.user.id) };
  }

  async getOrderParticipants(orderId: string) {
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, customerId: true, masterId: true, master: { select: { userId: true } } },
    });
    if (!order || order.customerId === order.master.userId) throw new NotFoundException(ERRORS.ORDER_NOT_FOUND);
    return {
      orderId: order.id,
      status: order.status,
      customerId: order.customerId,
      masterId: order.masterId,
      masterUserId: order.master.userId,
    };
  }

  async findAll(userId: string, panel: Panel | null = null) {
    const masterProfile = await this.db.masterProfile.findUnique({ where: { userId } });
    const asCustomer = { customerId: userId };
    const asMaster = { masterId: masterProfile?.id ?? '00000000-0000-0000-0000-000000000000' };
    const where: Prisma.OrderWhereInput =
      panel === 'MASTER' ? asMaster : panel === 'CUSTOMER' ? asCustomer : { OR: [asCustomer, asMaster] };
    const rows = await this.db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        booking: { select: { scheduledStartAt: true, service: { select: { id: true, name: true } }, request: { select: { title: true } } } },
        customer: { select: { id: true, accountNumber: true, firstName: true, lastName: true } },
        master: { select: { user: { select: { id: true, accountNumber: true, firstName: true, lastName: true } } } },
      },
    });
    const [customerSeq, masterSeq] = await Promise.all([
      this.db.order.findMany({ where: asCustomer, select: { id: true }, orderBy: [{ createdAt: 'asc' }, { orderNumber: 'asc' }] }),
      masterProfile ? this.db.order.findMany({ where: asMaster, select: { id: true }, orderBy: [{ createdAt: 'asc' }, { orderNumber: 'asc' }] }) : Promise.resolve([] as Array<{ id: string }>),
    ]);
    const customerIndex = new Map(customerSeq.map((row, index) => [row.id, index + 1]));
    const masterIndex = new Map(masterSeq.map((row, index) => [row.id, index + 1]));
    return rows
      .filter((row) => row.customerId !== row.master.user.id)
      .map(({ booking, customer, master, ...order }) => {
      const viewerRole = this.viewerRole(order.customerId === userId, master.user.id === userId, panel);
      const personal = (viewerRole === 'MASTER' ? masterIndex : customerIndex).get(order.id) ?? order.orderNumber;
      return {
        ...order,
        orderNumber: personal,
        viewerRole,
        service: booking.service,
        title: booking.request.title,
        scheduledStartAt: booking.scheduledStartAt,
        counterpart: viewerRole === 'MASTER' ? customer : master.user,
      };
    });
  }

  async confirm(userId: string, orderId: string, panel: Panel | null = null) {
    const actor = await this.resolveActor(userId, orderId, ['MASTER'], panel);
    return this.transition(orderId, 'CONFIRMED', actor, { confirmedAt: new Date() });
  }

  async startTravel(userId: string, orderId: string, panel: Panel | null = null) {
    const actor = await this.resolveActor(userId, orderId, ['MASTER'], panel);
    return this.transition(orderId, 'ON_THE_WAY', actor, {});
  }

  async arrive(userId: string, orderId: string, panel: Panel | null = null) {
    const actor = await this.resolveActor(userId, orderId, ['MASTER'], panel);
    return this.transition(orderId, 'ARRIVED', actor, {});
  }

  async createWorkProof(userId: string, orderId: string, dto: CreateWorkProofDto, panel: Panel | null = null) {
    await this.resolveActor(userId, orderId, ['MASTER'], panel);

    return this.db.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, orderId);
      if (order.status !== WORK_PROOF_STAGE_STATUS[dto.stage]) {
        throw new ForbiddenException(ERRORS.WORK_PROOF_CANNOT_ADD(dto.stage, order.status));
      }

      const asset = await tx.mediaAsset.findUnique({ where: { id: dto.mediaAssetId } });
      if (
        !asset ||
        asset.kind !== 'WORK_PROOF' ||
        asset.uploaderId !== userId ||
        asset.linkedResourceType !== 'Order' ||
        asset.linkedResourceId !== orderId
      ) {
        throw new ForbiddenException(ERRORS.MEDIA_NOT_WORK_PROOF);
      }
      if (asset.status !== 'READY' || !asset.originalKey) {
        throw new ForbiddenException(ERRORS.MEDIA_NOT_READY(asset.status));
      }

      const mime = asset.detectedMimeType ?? '';
      const mediaType = mime.startsWith('image/') ? 'PHOTO' : mime.startsWith('video/') ? 'VIDEO' : null;
      if (!mediaType) throw new ForbiddenException(ERRORS.WORK_PROOF_MEDIA_TYPE);

      const stageCount = await tx.workProof.count({
        where: { orderId, stage: dto.stage, mediaAssetId: { not: null } },
      });
      if (stageCount >= MAX_WORK_PROOFS_PER_STAGE) {
        throw new ForbiddenException(ERRORS.MAX_WORK_PROOFS(MAX_WORK_PROOFS_PER_STAGE, dto.stage));
      }

      try {
        return await tx.workProof.create({
          data: {
            orderId,
            uploadedById: userId,
            stage: dto.stage,
            mediaType,
            storageKey: asset.originalKey,
            mediaAssetId: asset.id,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException(ERRORS.MEDIA_USED_WORK_PROOF);
        }
        throw error;
      }
    });
  }

  async findAllWorkProofs(userId: string, orderId: string) {
    await this.findOne(userId, orderId);
    return this.db.workProof.findMany({
      where: { orderId },
      select: { id: true, stage: true, mediaType: true, mediaAssetId: true, uploadedById: true, createdAt: true },
      orderBy: [{ stage: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async removeWorkProof(userId: string, orderId: string, proofId: string, panel: Panel | null = null): Promise<{ deleted: true }> {
    await this.resolveActor(userId, orderId, ['MASTER'], panel);
    await this.db.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, orderId);
      const proof = await tx.workProof.findFirst({ where: { id: proofId, orderId } });
      if (!proof) throw new NotFoundException(ERRORS.WORK_PROOF_NOT_FOUND);
      if (proof.uploadedById !== userId) throw new ForbiddenException(ERRORS.NOT_WORK_PROOF_UPLOADER);
      if (order.status !== WORK_PROOF_STAGE_STATUS[proof.stage]) {
        throw new ForbiddenException(ERRORS.WORK_PROOF_CANNOT_REMOVE(proof.stage, order.status));
      }
      await tx.workProof.delete({ where: { id: proofId } });
    });
    return { deleted: true };
  }

  async findTimeline(userId: string, orderId: string) {
    await this.findOne(userId, orderId);
    return this.db.orderStatusHistory.findMany({
      where: { orderId },
      select: { id: true, oldStatus: true, newStatus: true, actorType: true, reason: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async startWork(userId: string, orderId: string, panel: Panel | null = null) {
    const actor = await this.resolveActor(userId, orderId, ['MASTER'], panel);
    const beforeProofCount = await this.db.workProof.count({
      where: { orderId, stage: 'BEFORE', mediaAssetId: { not: null } },
    });
    if (beforeProofCount === 0) {
      throw new ForbiddenException(ERRORS.BEFORE_PROOF_REQUIRED);
    }
    // Mijoz va usta kelishib vaqtni o'zgartirmagan bo'lsa, ish belgilangan vaqtdan oldin boshlanmaydi.
    const order = await this.db.order.findUniqueOrThrow({ where: { id: orderId }, select: { booking: { select: { scheduledStartAt: true } } } });
    if (order.booking.scheduledStartAt && order.booking.scheduledStartAt.getTime() > Date.now()) {
      throw new WorkTooEarlyException(formatUzDateTime(order.booking.scheduledStartAt));
    }
    return this.transition(orderId, 'IN_PROGRESS', actor, { startedAt: new Date() });
  }

  async submitCompletion(userId: string, orderId: string, panel: Panel | null = null) {
    const actor = await this.resolveActor(userId, orderId, ['MASTER'], panel);
    const afterProofCount = await this.db.workProof.count({
      where: { orderId, stage: 'AFTER', mediaAssetId: { not: null } },
    });
    if (afterProofCount === 0) {
      throw new ForbiddenException(ERRORS.AFTER_PROOF_REQUIRED);
    }
    return this.transition(orderId, 'WAITING_CONFIRMATION', actor, { completionSubmittedAt: new Date() });
  }

  async confirmCompletion(userId: string, orderId: string, panel: Panel | null = null, paymentMethod?: PaymentProvider) {
    const actor = await this.resolveActor(userId, orderId, ['CUSTOMER'], panel);
    const updated = await this.transition(orderId, 'COMPLETED', actor, { completedAt: new Date() });
    if (paymentMethod) await this.recordPaymentMethod(updated, userId, paymentMethod);
    return updated;
  }

  /** Mijoz tanlagan to‘lov usuli har doim yozib qo‘yiladi (naqd pul ham). Allaqachon to‘lov yozuvi bo‘lsa, ikkinchisi yaratilmaydi. */
  private async recordPaymentMethod(order: { id: string; masterId: string; finalAmount: Prisma.Decimal; currency: string }, customerId: string, provider: PaymentProvider) {
    const existing = await this.db.payment.findFirst({ where: { orderId: order.id, status: { in: ['PENDING', 'PROCESSING', 'SUCCEEDED', 'PARTIALLY_REFUNDED'] } } });
    if (existing) return;
    await this.db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: { orderId: order.id, customerId, provider, amount: order.finalAmount, currency: order.currency, status: 'PENDING', metadata: { chosenAt: 'ORDER_COMPLETION' } },
      });
      const master = await tx.masterProfile.findUniqueOrThrow({ where: { id: order.masterId }, select: { userId: true } });
      await this.outbox.emit(tx, {
        eventName: 'payment.method_chosen',
        aggregateType: 'Payment',
        aggregateId: payment.id,
        payload: { paymentId: payment.id, orderId: order.id, masterUserId: master.userId, provider, amount: String(order.finalAmount), currency: order.currency },
        createdById: customerId,
      });
    });
  }

  async dispute(userId: string, orderId: string, dto: ReasonDto, panel: Panel | null = null) {
    const actor = await this.resolveActor(userId, orderId, ['CUSTOMER', 'MASTER'], panel);
    let from: OrderStatus | null = null;
    const disputed = await this.db.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, orderId);
      assertTransition(order.status, 'DISPUTED', actor.type);
      from = order.status;
      const updated = await tx.order.update({ where: { id: orderId }, data: { status: 'DISPUTED' } });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          actorId: userId,
          actorType: actor.type,
          oldStatus: order.status,
          newStatus: 'DISPUTED',
          reason: dto.reason,
        },
      });
      await tx.case.create({
        data: {
          openedById: userId,
          orderId,
          type: 'DISPUTE',
          title: `Dispute on order ${orderId}`,
          description: dto.reason,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'ORDER_DISPUTED',
          targetType: 'Order',
          targetId: orderId,
          before: { status: order.status } as Prisma.InputJsonValue,
          after: { status: 'DISPUTED' } as Prisma.InputJsonValue,
          reason: dto.reason,
        },
      });
      await this.emitStatusChanged(tx, updated, actor, order.status, 'DISPUTED');
      return updated;
    });
    this.metrics.orderTransitioned(from, 'DISPUTED');
    return disputed;
  }

  async cancel(userId: string, orderId: string, dto: ReasonDto, panel: Panel | null = null) {
    const actor = await this.resolveActor(userId, orderId, ['CUSTOMER', 'MASTER'], panel);
    return this.transition(orderId, 'CANCELLED', actor, {
      cancelledAt: new Date(),
      cancellationReason: dto.reason,
    });
  }

  /** Mijoz yoki usta buyurtmaga yangi vaqt taklif qiladi — ikkinchi tomon tasdiqlashi kerak. */
  async proposeReschedule(userId: string, orderId: string, dto: ProposeRescheduleDto, panel: Panel | null = null) {
    const actor = await this.resolveActor(userId, orderId, ['CUSTOMER', 'MASTER'], panel);
    const proposedStartAt = new Date(dto.scheduledStartAt);
    if (proposedStartAt.getTime() <= Date.now()) throw new BadRequestException(ERRORS.RESCHEDULE_TIME_INVALID);

    return this.db.$transaction(async (tx) => {
      const locked = await this.lockOrder(tx, orderId);
      if (!RESCHEDULABLE_STATUSES.includes(locked.status)) throw new RescheduleNotAllowedException();
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { bookingId: true, customerId: true, masterId: true } });
      await tx.booking.update({
        where: { id: order.bookingId },
        data: { proposedStartAt, proposedById: userId, proposedAt: new Date() },
      });
      const masterProfile = await tx.masterProfile.findUniqueOrThrow({ where: { id: order.masterId }, select: { userId: true } });
      const notifyUserId = actor.type === 'CUSTOMER' ? masterProfile.userId : order.customerId;
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'ORDER_RESCHEDULE_PROPOSED',
          targetType: 'Order',
          targetId: orderId,
          after: { proposedStartAt: proposedStartAt.toISOString() } as Prisma.InputJsonValue,
        },
      });
      await this.notifyUser(tx, orderId, actor, notifyUserId, 'order.reschedule_proposed', { proposedStartAt: proposedStartAt.toISOString() });
      return { proposed: true, proposedStartAt };
    });
  }

  /** Ikkinchi tomon taklif qilingan vaqtni tasdiqlaydi — shu ondan e'tiboran yangi vaqt kuchga kiradi. */
  async acceptReschedule(userId: string, orderId: string, panel: Panel | null = null) {
    const actor = await this.resolveActor(userId, orderId, ['CUSTOMER', 'MASTER'], panel);
    return this.db.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { bookingId: true } });
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: order.bookingId } });
      if (!booking.proposedStartAt || !booking.proposedById) throw new RescheduleNotPendingException();
      if (booking.proposedById === userId) throw new RescheduleOwnProposalException();

      const updated = await tx.booking.update({
        where: { id: order.bookingId },
        data: { scheduledStartAt: booking.proposedStartAt, proposedStartAt: null, proposedById: null, proposedAt: null, reminderSentAt: null },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'ORDER_RESCHEDULE_ACCEPTED',
          targetType: 'Order',
          targetId: orderId,
          after: { scheduledStartAt: updated.scheduledStartAt!.toISOString() } as Prisma.InputJsonValue,
        },
      });
      await this.notifyUser(tx, orderId, actor, booking.proposedById, 'order.reschedule_accepted', { scheduledStartAt: updated.scheduledStartAt!.toISOString() });
      return { scheduledStartAt: updated.scheduledStartAt };
    });
  }

  /** Ikkinchi tomon taklif qilingan vaqtni rad etadi — buyurtmaning avvalgi vaqti o'zgarishsiz qoladi. */
  async declineReschedule(userId: string, orderId: string, panel: Panel | null = null) {
    const actor = await this.resolveActor(userId, orderId, ['CUSTOMER', 'MASTER'], panel);
    return this.db.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { bookingId: true } });
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: order.bookingId } });
      if (!booking.proposedStartAt || !booking.proposedById) throw new RescheduleNotPendingException();
      if (booking.proposedById === userId) throw new RescheduleOwnProposalException();

      await tx.booking.update({ where: { id: order.bookingId }, data: { proposedStartAt: null, proposedById: null, proposedAt: null } });
      await tx.auditLog.create({
        data: { actorId: userId, action: 'ORDER_RESCHEDULE_DECLINED', targetType: 'Order', targetId: orderId },
      });
      await this.notifyUser(tx, orderId, actor, booking.proposedById, 'order.reschedule_declined', {});
      return { declined: true };
    });
  }

  private async notifyUser(
    tx: Prisma.TransactionClient,
    orderId: string,
    actor: Actor,
    notifyUserId: string,
    eventName: string,
    extra: Record<string, unknown>,
  ) {
    await this.outbox.emit(tx, {
      eventName,
      aggregateType: 'Order',
      aggregateId: orderId,
      payload: { orderId, notifyUserId, ...extra },
      createdById: actor.userId,
    });
  }

  private async resolveActor(userId: string, orderId: string, allowed: OrderActor[], panel: Panel | null = null): Promise<Actor> {
    const order = await this.db.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException(ERRORS.ORDER_NOT_FOUND);
    const masterProfile = await this.db.masterProfile.findUnique({ where: { userId } });
    if (masterProfile && order.customerId === userId && order.masterId === masterProfile.id) {
      throw new NotFoundException(ERRORS.ORDER_NOT_FOUND);
    }

    const isCustomer = order.customerId === userId;
    const isMaster = !!masterProfile && order.masterId === masterProfile.id;
    const candidates: OrderActor[] = [];
    if (panel === 'MASTER') {
      if (isMaster) candidates.push('MASTER');
    } else if (panel === 'CUSTOMER') {
      if (isCustomer) candidates.push('CUSTOMER');
    } else {
      if (isCustomer) candidates.push('CUSTOMER');
      if (isMaster) candidates.push('MASTER');
    }
    const type = candidates.find((candidate) => allowed.includes(candidate));
    if (!type) throw new ForbiddenException(ERRORS.NOT_AUTHORIZED_ORDER_ACTION);
    return { userId, type };
  }

  private async lockOrder(tx: Prisma.TransactionClient, orderId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string; status: OrderStatus }>>`
      SELECT id, status FROM orders WHERE id = ${orderId}::uuid FOR UPDATE
    `;
    if (!rows[0]) throw new NotFoundException(ERRORS.ORDER_NOT_FOUND);
    return rows[0];
  }

  private async transition(
    orderId: string,
    to: OrderStatus,
    actor: Actor,
    extraData: Record<string, unknown>,
    reason: string | null = null,
  ) {
    let from: OrderStatus | null = null;
    const updated = await this.db.$transaction(async (tx) => {
      const locked = await this.lockOrder(tx, orderId);
      assertTransition(locked.status, to, actor.type);
      from = locked.status;

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: to, ...extraData },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          actorId: actor.userId,
          actorType: actor.type,
          oldStatus: locked.status,
          newStatus: to,
          reason,
        },
      });

      if (to === 'COMPLETED' || to === 'CANCELLED' || to === 'EXPIRED') {
        await this.masterStats.recompute(updated.masterId, tx);
      }

      // Admin orqali qilingan o'zgarishlar allaqachon AdminOrdersService tomonidan ADMIN_ORDER_* nomi bilan yoziladi.
      if (actor.type !== 'ADMIN') {
        await tx.auditLog.create({
          data: {
            actorId: actor.userId,
            action: `ORDER_${to}`,
            targetType: 'Order',
            targetId: orderId,
            before: { status: locked.status } as Prisma.InputJsonValue,
            after: { status: to } as Prisma.InputJsonValue,
            reason,
          },
        });
      }

      await this.emitStatusChanged(tx, updated, actor, locked.status, to);
      if (actor.type === 'ADMIN') await this.emitStatusChanged(tx, updated, actor, locked.status, to, 'MASTER');

      return updated;
    });
    this.metrics.orderTransitioned(from, to);
    return updated;
  }

  /** Administrator buyurtmani bekor qiladi (band qilingan, tasdiqlangan yoki nizoli holatda). */
  async adminCancel(adminId: string, orderId: string, reason: string) {
    return this.transition(orderId, 'CANCELLED', { userId: adminId, type: 'ADMIN' }, { cancelledAt: new Date(), cancellationReason: reason }, reason);
  }

  /** Administrator nizoli buyurtmani yakunlaydi yoki bekor qiladi. */
  async adminResolveDispute(adminId: string, orderId: string, decision: 'COMPLETE' | 'CANCEL', reason: string) {
    const actor: Actor = { userId: adminId, type: 'ADMIN' };
    return decision === 'COMPLETE'
      ? this.transition(orderId, 'COMPLETED', actor, { completedAt: new Date() }, reason)
      : this.transition(orderId, 'CANCELLED', actor, { cancelledAt: new Date(), cancellationReason: reason }, reason);
  }

  private async emitStatusChanged(
    tx: Prisma.TransactionClient,
    order: { id: string; customerId: string; masterId: string },
    actor: Actor,
    oldStatus: OrderStatus,
    newStatus: OrderStatus,
    recipient?: 'CUSTOMER' | 'MASTER',
  ) {
    const toMaster = recipient ? recipient === 'MASTER' : actor.type === 'CUSTOMER';
    let notifyUserId = order.customerId;
    if (toMaster) {
      const masterProfile = await tx.masterProfile.findUniqueOrThrow({ where: { id: order.masterId } });
      notifyUserId = masterProfile.userId;
    }
    await this.outbox.emit(tx, {
      eventName: 'order.status_changed',
      aggregateType: 'Order',
      aggregateId: order.id,
      payload: { orderId: order.id, oldStatus, newStatus, notifyUserId, actorType: actor.type, recipient: toMaster ? 'MASTER' : 'CUSTOMER' },
      createdById: actor.userId,
    });
  }
}
