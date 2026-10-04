import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProblemRequest } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ServiceService } from '../service/service.service';
import { CustomerService } from '../customer/customer.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { InvalidTransitionException } from '../../common/exceptions/business.exception';
import { CANCELLABLE_STATUSES, EDITABLE_STATUSES, type CursorPage } from '../../common/types/request.types';
import { CreateRequestDto } from './dto/create-request.dto';
import { CancelRequestDto } from './dto/cancel-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { RequestQueryDto } from './dto/request-query.dto';
import { ERRORS } from '../../common/constants/error-messages';
import { assertPhoneVerified } from '../../common/utils/phone-gate';

const REQUEST_DEFAULT_TTL_HOURS = 24;
const DUPLICATE_WINDOW_MS = 60_000;

export type ProblemRequestSummary = ProblemRequest & { service: { id: string; name: string } | null; offersCount: number };

@Injectable()
export class RequestService {
  private readonly logger = new Logger(RequestService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly outbox: OutboxService,
    private readonly catalog: ServiceService,
    private readonly customers: CustomerService,
  ) {}

  async create(customerId: string, dto: CreateRequestDto) {
    await assertPhoneVerified(this.db, customerId);
    // Manzil majburiy: saqlangan manzil yoki aniq koordinatalar.
    if (!dto.addressId && (dto.latitude == null || dto.longitude == null)) throw new BadRequestException(ERRORS.REQUEST_ADDRESS_REQUIRED);
    const selection = await this.validateReferences(customerId, dto);
    const duplicate = await this.db.problemRequest.findFirst({
      where: {
        customerId,
        status: 'DRAFT',
        title: dto.title,
        description: dto.description,
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
    });
    if (duplicate) return duplicate;

    const created = await this.db.problemRequest.create({
      data: {
        customerId,
        title: dto.title,
        description: dto.description,
        categoryId: selection?.categoryId ?? undefined,
        serviceId: selection?.serviceId ?? undefined,
        addressId: dto.addressId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        preferredStartAt: dto.preferredStartAt ? new Date(dto.preferredStartAt) : undefined,
        preferredEndAt: dto.preferredEndAt ? new Date(dto.preferredEndAt) : undefined,
        status: 'DRAFT',
      },
    });
    await this.db.auditLog.create({
      data: { actorId: customerId, action: 'REQUEST_CREATED', targetType: 'ProblemRequest', targetId: created.id },
    });
    return created;
  }

  async update(customerId: string, requestId: string, dto: UpdateRequestDto) {
    const request = await this.findOwned(customerId, requestId);
    if (!EDITABLE_STATUSES.includes(request.status)) {
      throw new ForbiddenException(ERRORS.ONLY_DRAFT_EDITABLE);
    }
    const selection = await this.validateReferences(customerId, dto);
    const updated = await this.db.problemRequest.update({
      where: { id: requestId },
      data: {
        title: dto.title,
        description: dto.description,
        categoryId: selection?.categoryId ?? undefined,
        serviceId: selection?.serviceId ?? undefined,
        addressId: dto.addressId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        preferredStartAt: dto.preferredStartAt ? new Date(dto.preferredStartAt) : undefined,
        preferredEndAt: dto.preferredEndAt ? new Date(dto.preferredEndAt) : undefined,
      },
    });
    await this.db.auditLog.create({
      data: { actorId: customerId, action: 'REQUEST_UPDATED', targetType: 'ProblemRequest', targetId: requestId },
    });
    return updated;
  }

  async submit(customerId: string, requestId: string) {
    const request = await this.findOwned(customerId, requestId);
    if (request.status !== 'DRAFT') {
      throw new InvalidTransitionException(request.status, 'SUBMITTED');
    }
    // Manzilsiz (eski) qoralama yuborilmaydi.
    if (!request.addressId && (request.latitude == null || request.longitude == null)) throw new BadRequestException(ERRORS.REQUEST_ADDRESS_REQUIRED);
    return this.db.$transaction(async (tx) => {
      const updated = await tx.problemRequest.update({
        where: { id: requestId },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
          expiresAt: new Date(Date.now() + REQUEST_DEFAULT_TTL_HOURS * 60 * 60 * 1000),
        },
      });
      await tx.auditLog.create({
        data: { actorId: customerId, action: 'REQUEST_SUBMITTED', targetType: 'ProblemRequest', targetId: requestId },
      });
      await this.outbox.emit(tx, {
        eventName: 'classification.requested',
        aggregateType: 'ProblemRequest',
        aggregateId: requestId,
        payload: { requestId },
        createdById: customerId,
      });
      return updated;
    });
  }

  async cancel(customerId: string, requestId: string, dto: CancelRequestDto) {
    const request = await this.findOwned(customerId, requestId);
    if (!CANCELLABLE_STATUSES.includes(request.status)) {
      throw new InvalidTransitionException(request.status, 'CANCELLED');
    }
    const updated = await this.db.problemRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED', cancellationReason: dto.reason, cancelledAt: new Date() },
    });
    await this.db.auditLog.create({
      data: { actorId: customerId, action: 'REQUEST_CANCELLED', targetType: 'ProblemRequest', targetId: requestId, reason: dto.reason },
    });
    return updated;
  }

  async findOne(customerId: string, requestId: string) {
    const request = await this.db.problemRequest.findUnique({
      where: { id: requestId },
      include: {
        booking: {
          select: {
            order: {
              select: {
                id: true,
                status: true,
                finalAmount: true,
                currency: true,
                master: { select: { profession: true, user: { select: { firstName: true, lastName: true, accountNumber: true } } } },
              },
            },
          },
        },
      },
    });
    if (!request) throw new NotFoundException(ERRORS.REQUEST_NOT_FOUND);
    if (request.customerId !== customerId) throw new ForbiddenException(ERRORS.NOT_REQUEST_OWNER);
    const { booking, ...rest } = request;
    return { ...rest, order: booking?.order ?? null };
  }

  async findAll(customerId: string, query: RequestQueryDto): Promise<CursorPage<ProblemRequestSummary>> {
    const limit = query.limit ?? 20;
    const rows = await this.db.problemRequest.findMany({
      where: { customerId, status: query.status },
      orderBy: { createdAt: query.sort ?? 'desc' },
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        service: { select: { id: true, name: true } },
        _count: { select: { offers: { where: { status: 'PENDING', master: { userId: { not: customerId } } } } } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = page.map(({ _count, ...request }) => ({ ...request, offersCount: _count.offers }));
    return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
  }

  /** Belgilangan muddatgacha hech qaysi usta taklif bermagan/mijoz qabul qilmagan so‘rovlarni bekor qiladi. */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireOverdueRequests(): Promise<void> {
    try {
      const now = new Date();
      const overdue = await this.db.problemRequest.findMany({
        where: { status: { in: ['SUBMITTED', 'MATCHING', 'OFFERS_RECEIVED'] }, expiresAt: { lte: now } },
        select: { id: true },
      });
      if (overdue.length === 0) return;
      const ids = overdue.map((request) => request.id);
      await this.db.$transaction([
        this.db.problemRequest.updateMany({
          where: { id: { in: ids } },
          data: { status: 'EXPIRED', cancelledAt: now },
        }),
        this.db.offer.updateMany({
          where: { requestId: { in: ids }, status: 'PENDING' },
          data: { status: 'EXPIRED' },
        }),
      ]);
      this.logger.log(`Muddati tugagan ${ids.length} ta so‘rov bekor qilingan buyurtmalarga o‘tkazildi`);
    } catch (error) {
      this.logger.error('Muddati tugagan so‘rovlarni yopib bo‘lmadi', error instanceof Error ? error.stack : undefined);
    }
  }

  private async validateReferences(
    customerId: string,
    dto: { categoryId?: string; serviceId?: string; addressId?: string; preferredStartAt?: string; preferredEndAt?: string },
  ) {
    // Buyurtma sanasi o‘tmishda bo‘lishi mumkin emas (soat farqi uchun 1 daqiqa yumshatma).
    const start = dto.preferredStartAt ? new Date(dto.preferredStartAt) : null;
    const end = dto.preferredEndAt ? new Date(dto.preferredEndAt) : null;
    if (start && start.getTime() < Date.now() - 60_000) throw new BadRequestException(ERRORS.AVAILABLE_AT_IN_FUTURE);
    if (end && end.getTime() < Date.now() - 60_000) throw new BadRequestException(ERRORS.AVAILABLE_AT_IN_FUTURE);
    if (start && end && end.getTime() < start.getTime()) throw new BadRequestException('Tugash vaqti boshlanish vaqtidan oldin bo‘lishi mumkin emas');
    if (dto.addressId) await this.customers.assertOwnsAddress(customerId, dto.addressId);
    if (!dto.categoryId && !dto.serviceId) return null;
    return this.catalog.assertCatalogSelection(dto.categoryId, dto.serviceId);
  }

  private async findOwned(customerId: string, requestId: string) {
    const request = await this.db.problemRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException(ERRORS.REQUEST_NOT_FOUND);
    if (request.customerId !== customerId) throw new ForbiddenException(ERRORS.NOT_REQUEST_OWNER);
    return request;
  }
}
