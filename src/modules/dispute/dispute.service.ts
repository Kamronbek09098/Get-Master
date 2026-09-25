import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CaseStatus, CaseType, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { InvalidTransitionException } from '../../common/exceptions/business.exception';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { OrderService } from '../order/order.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DisputeQueryDto } from './dto/dispute-query.dto';
import { UpdateDisputeStatusDto } from './dto/update-dispute-status.dto';
import { ERRORS } from '../../common/constants/error-messages';

const OPEN_STATUSES: CaseStatus[] = [CaseStatus.REPORTED, CaseStatus.UNDER_REVIEW, CaseStatus.CONFIRMED];

const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  [CaseStatus.REPORTED]: [CaseStatus.UNDER_REVIEW],
  [CaseStatus.UNDER_REVIEW]: [CaseStatus.CONFIRMED, CaseStatus.DISMISSED],
  [CaseStatus.CONFIRMED]: [CaseStatus.RESOLVED],
  [CaseStatus.DISMISSED]: [],
  [CaseStatus.RESOLVED]: [],
};

@Injectable()
export class DisputeService {
  constructor(
    private readonly db: PrismaService,
    private readonly orderService: OrderService,
  ) {}

  async create(userId: string, dto: CreateDisputeDto) {
    const participants = await this.orderService.getOrderParticipants(dto.orderId);
    if (participants.customerId !== userId && participants.masterUserId !== userId) {
      throw new ForbiddenException(ERRORS.NOT_ORDER_PARTICIPANT);
    }
    const targetUserId = participants.customerId === userId ? participants.masterUserId : participants.customerId;

    for (const item of dto.evidence ?? []) {
      if (!item.storageKey) continue;
      const asset = await this.db.mediaAsset.findFirst({
        where: { uploaderId: userId, status: 'READY', originalKey: item.storageKey },
        select: { id: true },
      });
      if (!asset) throw new ForbiddenException(ERRORS.EVIDENCE_NOT_OWNED);
    }

    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${dto.orderId}::uuid FOR UPDATE`;
      const existing = await tx.case.findFirst({
        where: { orderId: dto.orderId, type: CaseType.DISPUTE, status: { in: OPEN_STATUSES } },
        select: { id: true },
      });
      if (existing) throw new ConflictException(ERRORS.DISPUTE_ALREADY_OPEN);

      return tx.case.create({
        data: {
          type: CaseType.DISPUTE,
          openedById: userId,
          targetUserId,
          orderId: dto.orderId,
          title: dto.title,
          description: dto.description,
          evidence: dto.evidence
            ? { create: dto.evidence.map((e) => ({ type: e.type, storageKey: e.storageKey, text: e.text })) }
            : undefined,
        },
        include: { evidence: true },
      });
    });
  }

  async findAll(userId: string, query: DisputeQueryDto) {
    const rows = await this.db.case.findMany({
      where: { type: CaseType.DISPUTE, status: query.status, OR: [{ openedById: userId }, { targetUserId: userId }] },
      orderBy: { createdAt: 'desc' },
      ...cursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  async findAllForAdmin(query: DisputeQueryDto) {
    const rows = await this.db.case.findMany({
      where: { type: CaseType.DISPUTE, status: query.status },
      orderBy: { createdAt: 'desc' },
      ...cursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  async findOne(userId: string, disputeId: string) {
    const dispute = await this.db.case.findFirst({ where: { id: disputeId, type: CaseType.DISPUTE }, include: { evidence: true } });
    if (!dispute) throw new NotFoundException(ERRORS.DISPUTE_NOT_FOUND);
    if (dispute.openedById !== userId && dispute.targetUserId !== userId) {
      throw new ForbiddenException(ERRORS.DISPUTE_ACCESS_DENIED);
    }
    return dispute;
  }

  async updateStatus(adminId: string, disputeId: string, dto: UpdateDisputeStatusDto) {
    return this.db.$transaction(async (tx) => {
      const dispute = await tx.case.findFirst({ where: { id: disputeId, type: CaseType.DISPUTE } });
      if (!dispute) throw new NotFoundException(ERRORS.DISPUTE_NOT_FOUND);
      if (!ALLOWED_TRANSITIONS[dispute.status].includes(dto.status)) {
        throw new InvalidTransitionException(dispute.status, dto.status);
      }

      const changed = await tx.case.updateMany({
        where: { id: disputeId, status: dispute.status },
        data: {
          status: dto.status,
          decision: dto.decision,
          resolvedAt: dto.status === CaseStatus.RESOLVED ? new Date() : undefined,
        },
      });
      if (changed.count === 0) throw new InvalidTransitionException(dispute.status, dto.status);
      const updated = await tx.case.findUniqueOrThrow({ where: { id: disputeId } });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'DISPUTE_STATUS_CHANGED',
          targetType: 'Case',
          targetId: disputeId,
          before: { status: dispute.status } as Prisma.InputJsonValue,
          after: { status: dto.status, decision: dto.decision ?? null } as Prisma.InputJsonValue,
        },
      });
      return updated;
    });
  }
}
