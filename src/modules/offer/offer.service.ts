import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationChannel, Prisma } from '@prisma/client';
import { MasterStatsService } from '../master/master-stats.service';
import { AvailabilityService } from '../master/availability.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { NotificationService } from '../notification/notification.service';
import {
  AlreadyOfferedException,
  OfferNotAvailableException,
  MasterTimeUnavailableException,
  RequestAlreadyBookedException,
  RequestNotOpenForOffersException,
} from '../../common/exceptions/business.exception';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferQueryDto } from './dto/offer-query.dto';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { ERRORS } from '../../common/constants/error-messages';

const REQUEST_OPEN_STATUSES = ['SUBMITTED', 'MATCHING', 'OFFERS_RECEIVED'];
import { MetricsService } from '../../infrastructure/metrics/metrics.service';

const OFFER_DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;
const DEFAULT_JOB_MINUTES = 60;
const RELEASED_ORDER_STATUSES = ['CANCELLED', 'EXPIRED', 'COMPLETED'] as const;

const OFFER_SELECT = {
  id: true,
  requestId: true,
  masterId: true,
  price: true,
  currency: true,
  estimatedMinutes: true,
  message: true,
  availableAt: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  master: { select: { id: true, ratingAvg: true, ratingCount: true, user: { select: { accountNumber: true, firstName: true, lastName: true } } } },
} satisfies Prisma.OfferSelect;

@Injectable()
export class OfferService {
  private readonly logger = new Logger(OfferService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly outbox: OutboxService,
    private readonly availability: AvailabilityService,
    private readonly masterStats: MasterStatsService,
    private readonly metrics: MetricsService,
    private readonly notifications: NotificationService,
  ) {}

  async create(userId: string, dto: CreateOfferDto) {
    const masterProfile = await this.db.masterProfile.findUnique({ where: { userId } });
    if (!masterProfile) throw new ForbiddenException(ERRORS.MASTER_PROFILE_REQUIRED);
    if (
      masterProfile.verification !== 'VERIFIED' ||
      masterProfile.isPaused ||
      masterProfile.status === 'SUSPENDED' ||
      masterProfile.status === 'RESTRICTED'
    ) {
      throw new ForbiddenException(ERRORS.NOT_ELIGIBLE_TO_OFFER);
    }
    const now = Date.now();
    if (dto.availableAt && new Date(dto.availableAt).getTime() <= now) {
      throw new BadRequestException(ERRORS.AVAILABLE_AT_IN_FUTURE);
    }
    if (dto.expiresAt && new Date(dto.expiresAt).getTime() <= now) {
      throw new BadRequestException(ERRORS.EXPIRES_AT_IN_FUTURE);
    }

    const request = await this.db.problemRequest.findUnique({ where: { id: dto.requestId } });
    if (!request) throw new NotFoundException(ERRORS.REQUEST_NOT_FOUND);
    if (request.customerId === userId) throw new ForbiddenException(ERRORS.SELF_DEALING);
    if (!REQUEST_OPEN_STATUSES.includes(request.status)) {
      throw new RequestNotOpenForOffersException();
    }

    try {
      const offer = await this.db.offer.create({
        data: {
          requestId: dto.requestId,
          masterId: masterProfile.id,
          price: dto.price,
          estimatedMinutes: dto.estimatedMinutes,
          message: dto.message,
          availableAt: dto.availableAt ? new Date(dto.availableAt) : undefined,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : new Date(Date.now() + OFFER_DEFAULT_TTL_MS),
        },
      });

      await this.db.problemRequest.updateMany({
        where: { id: dto.requestId, status: { in: ['SUBMITTED', 'MATCHING'] } },
        data: { status: 'OFFERS_RECEIVED' },
      });
      await this.masterStats.recompute(masterProfile.id).catch((error: unknown) => {
        this.logger.warn(`Usta statistikasini yangilab bo‘lmadi: ${String(error)}`);
      });

      await this.notifyCustomer(request, offer, masterProfile.userId);
      return offer;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AlreadyOfferedException();
      }
      throw error;
    }
  }

  /** Mijozga yangi taklif haqida bildirishnoma; xato bo‘lsa taklif yaratilishiga xalaqit bermaydi. */
  private async notifyCustomer(request: { id: string; customerId: string; title: string }, offer: { id: string; price: Prisma.Decimal }, masterUserId: string) {
    try {
      const master = await this.db.user.findUnique({ where: { id: masterUserId }, select: { firstName: true, lastName: true, accountNumber: true } });
      const who = [master?.firstName, master?.lastName].filter(Boolean).join(' ') || `Usta ID ${master?.accountNumber ?? ''}`.trim();
      const price = Number(offer.price).toLocaleString('ru-RU');
      await this.notifications.create({
        userId: request.customerId,
        channel: NotificationChannel.IN_APP,
        title: 'So‘rovingizga yangi taklif keldi',
        body: `${who} «${request.title}» so‘rovingizga ${price} so‘m taklif qildi.`,
        template: 'offer.received',
        data: { requestId: request.id, offerId: offer.id },
      });
    } catch (error) {
      this.logger.warn(`Mijozga taklif bildirishnomasi yuborilmadi: ${String(error)}`);
    }
  }

  async findAllByRequest(customerId: string, requestId: string, query: OfferQueryDto) {
    const request = await this.db.problemRequest.findUnique({ where: { id: requestId }, select: { customerId: true } });
    if (!request) throw new NotFoundException(ERRORS.REQUEST_NOT_FOUND);
    if (request.customerId !== customerId) throw new ForbiddenException(ERRORS.NOT_REQUEST_OWNER);

    const rows = await this.db.offer.findMany({
      where: { requestId, status: query.status, master: { userId: { not: customerId } } },
      select: OFFER_SELECT,
      orderBy: { createdAt: 'desc' },
      ...cursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  async findAll(userId: string, query: OfferQueryDto) {
    const masterProfile = await this.db.masterProfile.findUnique({ where: { userId } });
    if (!masterProfile) throw new ForbiddenException(ERRORS.MASTER_PROFILE_REQUIRED);
    const rows = await this.db.offer.findMany({
      where: { masterId: masterProfile.id, status: query.status, request: { customerId: { not: userId } } },
      select: OFFER_SELECT,
      orderBy: { createdAt: 'desc' },
      ...cursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  async findOne(userId: string, offerId: string) {
    const offer = await this.db.offer.findUnique({
      where: { id: offerId },
      select: { ...OFFER_SELECT, request: { select: { customerId: true } }, master: { select: { ...OFFER_SELECT.master.select, userId: true } } },
    });
    if (!offer) throw new NotFoundException(ERRORS.OFFER_NOT_FOUND);
    if (offer.request.customerId === offer.master.userId) throw new NotFoundException(ERRORS.OFFER_NOT_FOUND);
    if (offer.request.customerId !== userId && offer.master.userId !== userId) {
      throw new ForbiddenException(ERRORS.NOT_OFFER_PARTICIPANT);
    }
    const { request: _request, master, ...rest } = offer;
    const { userId: _userId, ...publicMaster } = master;
    return { ...rest, master: publicMaster };
  }

  async withdraw(userId: string, offerId: string) {
    const masterProfile = await this.db.masterProfile.findUnique({ where: { userId } });
    if (!masterProfile) throw new ForbiddenException(ERRORS.MASTER_PROFILE_REQUIRED);

    const offer = await this.db.offer.findUnique({ where: { id: offerId } });
    if (!offer) throw new NotFoundException(ERRORS.OFFER_NOT_FOUND);
    if (offer.masterId !== masterProfile.id) throw new ForbiddenException(ERRORS.NOT_OFFER_OWNER);

    const result = await this.db.offer.updateMany({
      where: { id: offerId, status: 'PENDING' },
      data: { status: 'WITHDRAWN' },
    });
    if (result.count === 0) throw new OfferNotAvailableException();
    return this.db.offer.findUniqueOrThrow({ where: { id: offerId } });
  }

  async accept(customerId: string, offerId: string) {
    const booked = await this.db.$transaction(async (tx) => {
      const offer = await tx.offer.findUnique({ where: { id: offerId } });
      if (!offer) throw new NotFoundException(ERRORS.OFFER_NOT_FOUND);
      const offerMaster = await tx.masterProfile.findUnique({ where: { id: offer.masterId }, select: { userId: true } });
      if (offerMaster?.userId === customerId) throw new ForbiddenException(ERRORS.SELF_DEALING);

      const lockedRows = await tx.$queryRaw<Array<{ id: string; status: string; customerId: string; serviceId: string | null; latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null }>>`
        SELECT id, status, "customerId", "serviceId", latitude, longitude
        FROM problem_requests
        WHERE id = ${offer.requestId}::uuid
        FOR UPDATE
      `;
      const request = lockedRows[0];
      if (!request) throw new NotFoundException(ERRORS.REQUEST_NOT_FOUND);
      if (request.customerId !== customerId) throw new ForbiddenException(ERRORS.NOT_REQUEST_OWNER);
      if (!REQUEST_OPEN_STATUSES.includes(request.status)) {
        throw new RequestAlreadyBookedException();
      }

      const existingBooking = await tx.booking.findUnique({ where: { requestId: offer.requestId } });
      if (existingBooking) throw new RequestAlreadyBookedException();

      await this.assertMasterAvailable(tx, offer);

      const acceptedCount = await tx.offer.updateMany({
        where: { id: offerId, status: 'PENDING', expiresAt: { gt: new Date() } },
        data: { status: 'ACCEPTED' },
      });
      if (acceptedCount.count === 0) throw new OfferNotAvailableException();

      await tx.offer.updateMany({
        where: { requestId: offer.requestId, id: { not: offerId }, status: 'PENDING' },
        data: { status: 'REJECTED' },
      });

      await tx.problemRequest.update({ where: { id: offer.requestId }, data: { status: 'BOOKED' } });

      const booking = await tx.booking.create({
        data: {
          requestId: offer.requestId,
          offerId: offer.id,
          customerId,
          masterId: offer.masterId,
          serviceId: request.serviceId,
          scheduledStartAt: offer.availableAt,
          agreedPrice: offer.price,
          currency: offer.currency,
          locationSnapshot: { latitude: request.latitude, longitude: request.longitude },
        },
      });

      const order = await tx.order.create({
        data: {
          bookingId: booking.id,
          customerId,
          masterId: offer.masterId,
          status: 'BOOKED',
          originalAmount: offer.price,
          finalAmount: offer.price,
          currency: offer.currency,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          actorId: customerId,
          actorType: 'CUSTOMER',
          oldStatus: null,
          newStatus: 'BOOKED',
        },
      });

      const masterProfile = await tx.masterProfile.findUniqueOrThrow({ where: { id: offer.masterId } });
      await tx.conversation.create({
        data: {
          type: 'ORDER',
          orderId: order.id,
          participants: {
            create: [...new Set([customerId, masterProfile.userId])].map((userId) => ({
              userId,
              roles: [...(userId === customerId ? ['CUSTOMER'] : []), ...(userId === masterProfile.userId ? ['MASTER'] : [])],
            })),
          },
        },
      });
      await this.outbox.emit(tx, {
        eventName: 'order.booked',
        aggregateType: 'Order',
        aggregateId: order.id,
        payload: { orderId: order.id, masterUserId: masterProfile.userId, customerId },
        createdById: customerId,
      });

      return { booking, order };
    });
    this.metrics.orderTransitioned(null, 'BOOKED');
    return booked;
  }

  private async assertMasterAvailable(
    tx: Prisma.TransactionClient,
    offer: { id: string; masterId: string; availableAt: Date | null; estimatedMinutes: number | null },
  ): Promise<void> {
    await this.availability.assertBookable(tx, offer.masterId, offer.availableAt, offer.estimatedMinutes ?? DEFAULT_JOB_MINUTES);
    if (!offer.availableAt) return;
    const minutes = offer.estimatedMinutes ?? DEFAULT_JOB_MINUTES;
    const start = offer.availableAt;
    const end = new Date(start.getTime() + minutes * 60_000);

    const others = await tx.booking.findMany({
      where: {
        masterId: offer.masterId,
        scheduledStartAt: { not: null },
        order: { status: { notIn: [...RELEASED_ORDER_STATUSES] } },
      },
      select: { scheduledStartAt: true, offer: { select: { estimatedMinutes: true } } },
    });

    const overlaps = others.some((booking) => {
      const otherStart = booking.scheduledStartAt as Date;
      const otherEnd = new Date(otherStart.getTime() + (booking.offer.estimatedMinutes ?? DEFAULT_JOB_MINUTES) * 60_000);
      return otherStart < end && start < otherEnd;
    });
    if (overlaps) throw new MasterTimeUnavailableException();
  }
}
