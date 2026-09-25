import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CaseStatus, CaseType } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { InvalidTransitionException } from '../../common/exceptions/business.exception';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { OrderService } from '../order/order.service';
import { ComplaintQueryDto } from './dto/complaint-query.dto';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';

const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  REPORTED: [CaseStatus.UNDER_REVIEW],
  UNDER_REVIEW: [CaseStatus.CONFIRMED, CaseStatus.DISMISSED],
  CONFIRMED: [CaseStatus.RESOLVED],
  DISMISSED: [],
  RESOLVED: [],
};

@Injectable()
export class ComplaintService {
  constructor(
    private readonly db: PrismaService,
    private readonly orderService: OrderService,
  ) {}

  async create(userId: string, dto: CreateComplaintDto) {
    let targetUserId = dto.targetUserId;

    if (dto.orderId) {
      const order = await this.orderService.getOrderParticipants(dto.orderId);
      if (order.customerId !== userId && order.masterUserId !== userId) {
        throw new ForbiddenException(ERRORS.NOT_ORDER_PARTICIPANT);
      }
      if (!targetUserId) {
        targetUserId = order.customerId === userId ? order.masterUserId : order.customerId;
      }
    }

    if (targetUserId) {
      const target = await this.db.user.findUnique({ where: { id: targetUserId } });
      if (!target) {
        throw new NotFoundException(ERRORS.USER_NOT_FOUND);
      }
    }

    return this.db.case.create({
      data: {
        type: CaseType.COMPLAINT,
        openedById: userId,
        targetUserId,
        orderId: dto.orderId,
        title: dto.title,
        description: dto.description,
      },
    });
  }

  async findAll(userId: string, query: ComplaintQueryDto) {
    const rows = await this.db.case.findMany({
      where: { type: CaseType.COMPLAINT, status: query.status, openedById: userId },
      orderBy: { createdAt: 'desc' },
      ...cursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  async findAllForAdmin(query: ComplaintQueryDto) {
    const rows = await this.db.case.findMany({
      where: { type: CaseType.COMPLAINT, status: query.status },
      orderBy: { createdAt: 'desc' },
      ...cursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  async findOne(userId: string, id: string) {
    const complaint = await this.db.case.findFirst({ where: { id, type: CaseType.COMPLAINT } });
    if (!complaint) {
      throw new NotFoundException(ERRORS.COMPLAINT_NOT_FOUND);
    }
    if (complaint.openedById !== userId) {
      throw new ForbiddenException(ERRORS.FORBIDDEN);
    }
    return complaint;
  }

  async updateStatus(adminId: string, id: string, dto: UpdateComplaintStatusDto) {
    const complaint = await this.db.case.findFirst({ where: { id, type: CaseType.COMPLAINT } });
    if (!complaint) {
      throw new NotFoundException(ERRORS.COMPLAINT_NOT_FOUND);
    }
    if (!ALLOWED_TRANSITIONS[complaint.status].includes(dto.status)) {
      throw new InvalidTransitionException(complaint.status, dto.status);
    }

    const updated = await this.db.case.update({
      where: { id },
      data: {
        status: dto.status,
        decision: dto.decision,
        resolvedAt: dto.status === CaseStatus.RESOLVED || dto.status === CaseStatus.DISMISSED ? new Date() : null,
      },
    });

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        action: 'COMPLAINT_STATUS_CHANGED',
        targetType: 'Case',
        targetId: id,
        before: { status: complaint.status },
        after: { status: dto.status },
      },
    });
    return updated;
  }
}
