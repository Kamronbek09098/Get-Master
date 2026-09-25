import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderActor, OrderStatus, Prisma, WorkStage } from '@prisma/client';
import { MasterStatsService } from '../master/master-stats.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { assertTransition } from './order-state-machine';
import { CreateWorkProofDto } from './dto/create-work-proof.dto';
import { OrderHistoryQueryDto } from './dto/order-history-query.dto';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { ReasonDto } from './dto/reason.dto';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { ERRORS } from '../../common/constants/error-messages';
import type { Panel } from '../../common/utils/panel';

const MAX_WORK_PROOFS_PER_STAGE = 10;

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
      },
    });
    if (!order || order.customerId === order.master.user.id) throw new NotFoundException(ERRORS.ORDER_NOT_FOUND);
    const isCustomer = order.customerId === userId;
    const isMaster = order.master.user.id === userId;
    const viewerRole = this.viewerRole(isCustomer, isMaster, panel);
    if (!viewerRole) throw new ForbiddenException(ERRORS.NOT_ORDER_PARTICIPANT);
    const { booking, customer, master, conversation, ...rest } = order;
    return {
      ...rest,
      viewerRole,
      service: booking.service,
      request: booking.request,
      scheduledStartAt: booking.scheduledStartAt,
      conversationId: conversation?.id ?? null,
      counterpart: viewerRole === 'MASTER' ? customer : { ...master.user, profession: master.profession },
    };
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
    return rows
      .filter((row) => row.customerId !== row.master.user.id)
      .map(({ booking, customer, master, ...order }) => {
      const viewerRole = this.viewerRole(order.customerId === userId, master.user.id === userId, panel);
      return {
        ...order,
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

  async confirmCompletion(userId: string, orderId: string, panel: Panel | null = null) {
    const actor = await this.resolveActor(userId, orderId, ['CUSTOMER'], panel);
    return this.transition(orderId, 'COMPLETED', actor, { completedAt: new Date() });
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
          reason: null,
        },
      });

      if (to === 'COMPLETED' || to === 'CANCELLED' || to === 'EXPIRED') {
        await this.masterStats.recompute(updated.masterId, tx);
      }

      await this.emitStatusChanged(tx, updated, actor, locked.status, to);

      return updated;
    });
    this.metrics.orderTransitioned(from, to);
    return updated;
  }

  private async emitStatusChanged(
    tx: Prisma.TransactionClient,
    order: { id: string; customerId: string; masterId: string },
    actor: Actor,
    oldStatus: OrderStatus,
    newStatus: OrderStatus,
  ) {
    let notifyUserId = order.customerId;
    if (actor.type === 'CUSTOMER') {
      const masterProfile = await tx.masterProfile.findUniqueOrThrow({ where: { id: order.masterId } });
      notifyUserId = masterProfile.userId;
    }
    await this.outbox.emit(tx, {
      eventName: 'order.status_changed',
      aggregateType: 'Order',
      aggregateId: order.id,
      payload: { orderId: order.id, oldStatus, newStatus, notifyUserId, actorType: actor.type },
      createdById: actor.userId,
    });
  }
}
