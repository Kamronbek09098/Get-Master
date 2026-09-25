import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AdditionalWorkStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { OrderService } from '../order/order.service';
import { CreateAdditionalWorkDto } from './dto/create-additional-work.dto';

@Injectable()
export class WorkService {
  constructor(
    private readonly db: PrismaService,
    private readonly orderService: OrderService,
  ) {}

  async create(userId: string, orderId: string, dto: CreateAdditionalWorkDto) {
    const order = await this.orderService.getOrderParticipants(orderId);
    if (order.masterUserId !== userId) {
      throw new ForbiddenException(ERRORS.NOT_ORDER_PARTICIPANT);
    }
    if (order.status !== OrderStatus.ARRIVED && order.status !== OrderStatus.IN_PROGRESS) {
      throw new ConflictException(ERRORS.ORDER_NOT_IN_PROGRESS);
    }

    return this.db.additionalWorkRequest.create({
      data: {
        orderId,
        requestedById: userId,
        reason: dto.reason,
        description: dto.description,
        amount: dto.amount,
        evidence: dto.evidenceKey ? { storageKey: dto.evidenceKey } : undefined,
      },
    });
  }

  async findAll(userId: string, orderId: string) {
    const order = await this.orderService.getOrderParticipants(orderId);
    if (order.customerId !== userId && order.masterUserId !== userId) {
      throw new ForbiddenException(ERRORS.NOT_ORDER_PARTICIPANT);
    }

    return this.db.additionalWorkRequest.findMany({
      where: { orderId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async approve(userId: string, id: string) {
    const work = await this.findPending(id);
    const order = await this.orderService.getOrderParticipants(work.orderId);
    if (order.customerId !== userId) {
      throw new ForbiddenException(ERRORS.NOT_ORDER_OWNER);
    }

    const [updated] = await this.db.$transaction([
      this.db.additionalWorkRequest.update({
        where: { id },
        data: { status: AdditionalWorkStatus.APPROVED, respondedAt: new Date() },
      }),
      this.db.order.update({
        where: { id: work.orderId },
        data: {
          additionalAmount: { increment: work.amount },
          finalAmount: { increment: work.amount },
        },
      }),
    ]);
    return updated;
  }

  async reject(userId: string, id: string) {
    const work = await this.findPending(id);
    const order = await this.orderService.getOrderParticipants(work.orderId);
    if (order.customerId !== userId) {
      throw new ForbiddenException(ERRORS.NOT_ORDER_OWNER);
    }

    return this.db.additionalWorkRequest.update({
      where: { id },
      data: { status: AdditionalWorkStatus.REJECTED, respondedAt: new Date() },
    });
  }

  async cancel(userId: string, id: string) {
    const work = await this.findPending(id);
    if (work.requestedById !== userId) {
      throw new ForbiddenException(ERRORS.FORBIDDEN);
    }

    return this.db.additionalWorkRequest.update({
      where: { id },
      data: { status: AdditionalWorkStatus.CANCELLED, respondedAt: new Date() },
    });
  }

  private async findPending(id: string) {
    const work = await this.db.additionalWorkRequest.findUnique({ where: { id } });
    if (!work) {
      throw new NotFoundException(ERRORS.ADDITIONAL_WORK_NOT_FOUND);
    }
    if (work.status !== AdditionalWorkStatus.PENDING) {
      throw new ConflictException(ERRORS.ADDITIONAL_WORK_NOT_PENDING);
    }
    return work;
  }
}
