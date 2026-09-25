import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, WarrantyClaimStatus, WarrantyStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { DEFAULT_WARRANTY_DAYS } from '../../common/constants/app.constants';
import { OrderService } from '../order/order.service';
import { CreateWarrantyClaimDto } from './dto/create-warranty-claim.dto';
import { CreateWarrantyDto } from './dto/create-warranty.dto';
import { UpdateWarrantyClaimDto } from './dto/update-warranty-claim.dto';

@Injectable()
export class WarrantyService {
  constructor(
    private readonly db: PrismaService,
    private readonly orderService: OrderService,
  ) {}

  async create(userId: string, dto: CreateWarrantyDto) {
    const order = await this.orderService.getOrderParticipants(dto.orderId);
    if (order.masterUserId !== userId) {
      throw new ForbiddenException(ERRORS.NOT_ORDER_PARTICIPANT);
    }
    if (order.status !== OrderStatus.COMPLETED) {
      throw new ConflictException(ERRORS.ORDER_NOT_COMPLETED);
    }

    const existing = await this.db.warranty.findUnique({ where: { orderId: dto.orderId } });
    if (existing) {
      throw new ConflictException(ERRORS.WARRANTY_EXISTS);
    }

    const days = dto.days ?? DEFAULT_WARRANTY_DAYS;
    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);

    return this.db.warranty.create({
      data: {
        orderId: dto.orderId,
        masterId: order.masterId,
        startsAt,
        expiresAt,
        conditions: dto.conditions,
      },
    });
  }

  findAll(userId: string) {
    return this.db.warranty.findMany({
      where: {
        OR: [{ order: { customerId: userId } }, { master: { userId } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const warranty = await this.db.warranty.findUnique({
      where: { id },
      include: { order: { select: { customerId: true } }, master: { select: { userId: true } } },
    });
    if (!warranty) {
      throw new NotFoundException(ERRORS.WARRANTY_NOT_FOUND);
    }
    if (warranty.order.customerId !== userId && warranty.master.userId !== userId) {
      throw new ForbiddenException(ERRORS.FORBIDDEN);
    }
    return warranty;
  }

  async createClaim(userId: string, id: string, dto: CreateWarrantyClaimDto) {
    const warranty = await this.findOne(userId, id);
    if (warranty.order.customerId !== userId) {
      throw new ForbiddenException(ERRORS.NOT_ORDER_OWNER);
    }
    if (warranty.status !== WarrantyStatus.ACTIVE || warranty.expiresAt < new Date()) {
      throw new ConflictException(ERRORS.WARRANTY_NOT_ACTIVE);
    }

    return this.db.warrantyClaim.create({
      data: {
        warrantyId: id,
        openedById: userId,
        reason: dto.reason,
        description: dto.description,
        evidence: dto.evidenceKey ? { storageKey: dto.evidenceKey } : undefined,
      },
    });
  }

  async findAllClaims(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.db.warrantyClaim.findMany({
      where: { warrantyId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateClaim(adminId: string, id: string, dto: UpdateWarrantyClaimDto) {
    const claim = await this.db.warrantyClaim.findUnique({ where: { id } });
    if (!claim) {
      throw new NotFoundException(ERRORS.WARRANTY_CLAIM_NOT_FOUND);
    }

    const isFinished = dto.status === WarrantyClaimStatus.RESOLVED || dto.status === WarrantyClaimStatus.REJECTED;
    const updated = await this.db.warrantyClaim.update({
      where: { id },
      data: {
        status: dto.status,
        resolution: dto.resolution,
        resolvedAt: isFinished ? new Date() : null,
      },
    });

    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        action: 'WARRANTY_CLAIM_UPDATED',
        targetType: 'WarrantyClaim',
        targetId: id,
        before: { status: claim.status },
        after: { status: dto.status },
      },
    });
    return updated;
  }
}
