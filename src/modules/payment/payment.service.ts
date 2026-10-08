import { SubscriptionService } from '../subscription/subscription.service';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentProvider, PaymentStatus, Prisma, Role } from '@prisma/client';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { EarningsQueryDto } from './dto/earnings-query.dto';
import { EarningsOverviewQueryDto } from './dto/earnings-overview-query.dto';
import { PaymentHistoryQueryDto } from './dto/payment-history-query.dto';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import {
  OrderAlreadyPaidException,
  OrderNotPayableException,
  PaymentNotRefundableException,
  RefundExceedsCapturedException,
  WebhookVerificationFailedException,
} from '../../common/exceptions/business.exception';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { ERRORS } from '../../common/constants/error-messages';
import { ClickService } from './click/click.service';
import { PaymeService } from './payme/payme.service';

const PUBLIC_PAYMENT_SELECT = {
  id: true,
  orderId: true,
  provider: true,
  amount: true,
  refundedAmount: true,
  currency: true,
  status: true,
  succeededAt: true,
  failedAt: true,
  createdAt: true,
} satisfies Prisma.PaymentSelect;

const SETTLED_STATUSES: PaymentStatus[] = ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'];

interface WebhookPayload {
  eventId: string;
  paymentId: string;
  status: 'SUCCEEDED' | 'FAILED';
  amount: number;
  currency: string;
  providerPaymentId?: string;
  failureReason?: string;
}
import { MetricsService } from '../../infrastructure/metrics/metrics.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
    private readonly metrics: MetricsService,
    private readonly click: ClickService,
    private readonly payme: PaymeService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async create(customerId: string, dto: CreatePaymentDto) {
    const payment = await this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; status: OrderStatus; customerId: string; masterUserId: string }>>`
        SELECT o.id, o.status, o."customerId", mp."userId" AS "masterUserId"
        FROM orders o JOIN master_profiles mp ON mp.id = o."masterId"
        WHERE o.id = ${dto.orderId}::uuid FOR UPDATE OF o`;
      const order = rows[0];
      if (!order || order.customerId === order.masterUserId) throw new NotFoundException(ERRORS.ORDER_NOT_FOUND);
      if (order.customerId !== customerId) throw new ForbiddenException(ERRORS.NOT_ORDER_OWNER);
      if (order.status === 'CANCELLED' || order.status === 'EXPIRED') throw new OrderNotPayableException();

      const settled = await tx.payment.findFirst({ where: { orderId: order.id, status: { in: SETTLED_STATUSES } } });
      if (settled) throw new OrderAlreadyPaidException();

      // Mijoz usulni almashtirsa, boshqa usuldagi kutilayotgan to‘lov bekor qilinadi (bitta buyurtmada bitta faol to‘lov).
      await tx.payment.updateMany({
        where: { orderId: order.id, status: 'PENDING', provider: { not: dto.provider } },
        data: { status: 'CANCELLED' },
      });
      const pending = await tx.payment.findFirst({
        where: { orderId: order.id, provider: dto.provider, status: 'PENDING' },
      });
      if (pending) return pending;

      const full = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
      const created = await tx.payment.create({
        data: {
          orderId: order.id,
          customerId,
          provider: dto.provider,
          amount: full.finalAmount,
          currency: full.currency,
          status: 'PENDING',
        },
      });
      // Ustaga: mijoz to‘lov usulini tanladi (naqd bo‘lsa, pulni olgach tasdiqlashi kerak).
      await this.outbox.emit(tx, {
        eventName: 'payment.method_chosen',
        aggregateType: 'Payment',
        aggregateId: created.id,
        payload: { paymentId: created.id, orderId: order.id, masterUserId: order.masterUserId, provider: created.provider, amount: String(created.amount), currency: created.currency },
        createdById: customerId,
      });
      return created;
    });

    return { payment, checkoutUrl: this.buildCheckoutUrl(payment) };
  }

  /** Naqd pul uchun onlayn to‘lov sahifasi yo‘q. Click/Payme sozlangan bo‘lsa haqiqiy checkout sahifasiga, aks holda sinov havolasiga yo‘naltiradi. */
  private buildCheckoutUrl(payment: { id: string; provider: PaymentProvider; amount: Prisma.Decimal }): string | null {
    if (payment.provider === 'CASH') return null;
    if (payment.provider === 'CLICK' && this.click.isConfigured()) return this.click.buildCheckoutUrl(payment);
    if (payment.provider === 'PAYME' && this.payme.isConfigured()) return this.payme.buildCheckoutUrl(payment);
    return `https://payment.example/checkout/${payment.id}`;
  }

  /** Usta (yoki admin) naqd pul qabul qilinganini tasdiqlaydi. */
  async confirmCash(actorId: string, roles: Role[], paymentId: string) {
    const payment = await this.db.payment.findUnique({ where: { id: paymentId }, include: { order: { select: { master: { select: { userId: true } } } } } });
    if (!payment) throw new NotFoundException(ERRORS.PAYMENT_NOT_FOUND);
    const isAdmin = roles.includes(Role.ADMIN);
    if (!isAdmin && payment.order.master.userId !== actorId) throw new ForbiddenException(ERRORS.NOT_ORDER_PARTICIPANT);
    if (payment.provider !== 'CASH') throw new BadRequestException('Bu to‘lov naqd pul emas');
    if (payment.status === 'SUCCEEDED') return payment;
    if (payment.status !== 'PENDING' && payment.status !== 'PROCESSING') throw new ConflictException('To‘lov holati tasdiqlash uchun mos emas');

    return this.db.$transaction(async (tx) => {
      const result = await tx.payment.update({ where: { id: paymentId }, data: { status: 'SUCCEEDED', succeededAt: new Date(), metadata: { ...(payment.metadata as object | null), cashConfirmedBy: actorId } } });
      await tx.auditLog.create({ data: { actorId, action: 'PAYMENT_CASH_CONFIRMED', targetType: 'Payment', targetId: paymentId, before: { status: payment.status }, after: { status: 'SUCCEEDED' } } });
      await this.outbox.emit(tx, {
        eventName: 'payment.succeeded',
        aggregateType: 'Payment',
        aggregateId: result.id,
        payload: { paymentId: result.id, orderId: result.orderId, customerId: result.customerId },
      });
      return result;
    });
  }

  async findHistory(customerId: string, query: PaymentHistoryQueryDto) {
    const rows = await this.db.payment.findMany({
      where: {
        customerId,
        status: query.status,
        provider: query.provider,
        ...(query.dateFrom || query.dateTo
          ? {
              createdAt: {
                ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
                ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
              },
            }
          : {}),
      },
      select: PUBLIC_PAYMENT_SELECT,
      orderBy: { createdAt: 'desc' },
      ...cursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  async findEarnings(userId: string, query: EarningsQueryDto) {
    const masterProfile = await this.db.masterProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!masterProfile) throw new NotFoundException(ERRORS.MASTER_PROFILE_NOT_FOUND);

    const where: Prisma.PaymentWhereInput = {
      status: { in: SETTLED_STATUSES },
      order: { masterId: masterProfile.id },
      ...(query.dateFrom || query.dateTo
        ? {
            succeededAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [aggregate, rows] = await Promise.all([
      this.db.payment.aggregate({ where, _sum: { amount: true, refundedAmount: true }, _count: true }),
      this.db.payment.findMany({
        where,
        select: PUBLIC_PAYMENT_SELECT,
        orderBy: { createdAt: 'desc' },
        ...cursorArgs(query),
      }),
    ]);

    const gross = aggregate._sum.amount ?? new Prisma.Decimal(0);
    const refunded = aggregate._sum.refundedAmount ?? new Prisma.Decimal(0);
    return {
      summary: { grossAmount: gross, refundedAmount: refunded, netAmount: gross.sub(refunded), paymentCount: aggregate._count },
      ...toCursorPage(rows, query),
    };
  }

  /**
   * Ustaning daromad ko‘rinishi: bugun/hafta/oy/jami, kunlik grafik, to‘lov usullari va kutilayotgan (naqd) to‘lovlar.
   * Kunlar Toshkent vaqti (UTC+5) bo‘yicha hisoblanadi.
   */
  async earningsOverview(userId: string, query: EarningsOverviewQueryDto) {
    const masterProfile = await this.db.masterProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!masterProfile) throw new NotFoundException(ERRORS.MASTER_PROFILE_NOT_FOUND);
    const days = query.days ?? 30;
    const TZ_MS = 5 * 60 * 60 * 1000;
    const dayKey = (date: Date) => new Date(date.getTime() + TZ_MS).toISOString().slice(0, 10);
    const now = new Date();
    const today = dayKey(now);
    const dayShift = (key: string, delta: number) => new Date(Date.parse(`${key}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);
    const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // dushanba = 0
    const weekStart = dayShift(today, -weekday);
    const monthStart = `${today.slice(0, 8)}01`;
    const chartStart = dayShift(today, -(days - 1));
    const earliest = [chartStart, weekStart, monthStart].sort()[0]!;
    const since = new Date(`${earliest}T00:00:00+05:00`);

    const [rows, providers, all, pending] = await Promise.all([
      this.db.$queryRaw<Array<{ day: string; gross: Prisma.Decimal; net: Prisma.Decimal; count: number }>>`
        SELECT to_char((p.succeeded_at AT TIME ZONE 'Asia/Tashkent')::date, 'YYYY-MM-DD') AS day,
               COALESCE(SUM(p.amount), 0) AS gross,
               COALESCE(SUM(p.amount - p.refunded_amount), 0) AS net,
               COUNT(*)::int AS count
        FROM payments p JOIN orders o ON o.id = p."orderId"
        WHERE o."masterId" = ${masterProfile.id}::uuid
          AND p.status IN ('SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED')
          AND p.succeeded_at >= ${since}
        GROUP BY 1 ORDER BY 1`,
      this.db.$queryRaw<Array<{ provider: string; net: Prisma.Decimal; count: number }>>`
        SELECT p.provider::text AS provider, COALESCE(SUM(p.amount - p.refunded_amount), 0) AS net, COUNT(*)::int AS count
        FROM payments p JOIN orders o ON o.id = p."orderId"
        WHERE o."masterId" = ${masterProfile.id}::uuid
          AND p.status IN ('SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED')
          AND p.succeeded_at >= ${new Date(`${chartStart}T00:00:00+05:00`)}
        GROUP BY 1 ORDER BY 2 DESC`,
      this.db.payment.aggregate({
        where: { status: { in: SETTLED_STATUSES }, order: { masterId: masterProfile.id } },
        _sum: { amount: true, refundedAmount: true },
        _count: true,
      }),
      this.db.payment.aggregate({
        where: { status: { in: ['PENDING', 'PROCESSING'] }, order: { masterId: masterProfile.id, status: { in: ['WAITING_CONFIRMATION', 'COMPLETED'] } } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const byDay = new Map(rows.map((row) => [row.day, { net: Number(row.net), gross: Number(row.gross), count: row.count }]));
    const daily = Array.from({ length: days }, (_, index) => {
      const date = dayShift(chartStart, index);
      return { date, ...(byDay.get(date) ?? { net: 0, gross: 0, count: 0 }) };
    });
    const sumFrom = (start: string) => {
      let net = 0;
      let count = 0;
      for (const [day, value] of byDay) if (day >= start) { net += value.net; count += value.count; }
      return { net, count };
    };
    const yesterday = byDay.get(dayShift(today, -1));
    const allNet = Number(all._sum.amount ?? 0) - Number(all._sum.refundedAmount ?? 0);
    const chartTotal = daily.reduce((sum, item) => sum + item.net, 0);
    const bestDay = daily.reduce((best, item) => (item.net > best.net ? item : best), daily[0]!);
    return {
      currency: 'UZS',
      today: { date: today, ...sumFrom(today), yesterday: yesterday?.net ?? 0 },
      week: sumFrom(weekStart),
      month: sumFrom(monthStart),
      all: { net: allNet, count: all._count },
      pending: { amount: Number(pending._sum.amount ?? 0), count: pending._count },
      range: { days, net: chartTotal, average: Math.round(chartTotal / days), bestDay: bestDay.net > 0 ? bestDay : null },
      daily,
      providers: providers.map((row) => ({ provider: row.provider, net: Number(row.net), count: row.count })),
    };
  }

  async findOne(userId: string, paymentId: string) {
    const payment = await this.db.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException(ERRORS.PAYMENT_NOT_FOUND);
    if (payment.customerId !== userId) throw new ForbiddenException(ERRORS.NOT_PAYMENT_OWNER);
    return payment;
  }

  async refund(actorId: string, paymentId: string, dto: CreateRefundDto, idempotencyKey?: string) {
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; amount: Prisma.Decimal; refundedAmount: Prisma.Decimal; status: PaymentStatus; currency: string }>
      >`SELECT id, amount, refunded_amount as "refundedAmount", status, currency FROM payments WHERE id = ${paymentId}::uuid FOR UPDATE`;
      const payment = rows[0];
      if (!payment) throw new NotFoundException(ERRORS.PAYMENT_NOT_FOUND);

      if (!SETTLED_STATUSES.includes(payment.status)) throw new PaymentNotRefundableException();

      const captured = Number(payment.amount);
      const alreadyRefunded = Number(payment.refundedAmount);
      const refundable = captured - alreadyRefunded;
      if (dto.amount <= 0 || dto.amount > refundable) {
        throw new RefundExceedsCapturedException();
      }

      const refund = await tx.refund.create({
        data: {
          paymentId,
          amount: dto.amount,
          currency: payment.currency,
          reason: dto.reason,
          status: 'SUCCEEDED',
          idempotencyKey,
          metadata: { note: dto.note, actorId },
          completedAt: new Date(),
        },
      });

      const newRefundedAmount = alreadyRefunded + dto.amount;
      const newStatus: PaymentStatus = newRefundedAmount >= captured ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      await tx.payment.update({
        where: { id: paymentId },
        data: { refundedAmount: newRefundedAmount, status: newStatus },
      });

      await tx.auditLog.create({
        data: {
          actorId: actorId,
          action: 'PAYMENT_REFUNDED',
          targetType: 'Payment',
          targetId: paymentId,
          reason: dto.reason,
          after: { amount: String(dto.amount), currency: payment.currency, newStatus } as Prisma.InputJsonValue,
        },
      });

      return refund;
    });
  }

  verifyWebhookSignature(provider: PaymentProvider, rawBody: Buffer, signatureHeader: string | undefined): void {
    if (!signatureHeader) throw new WebhookVerificationFailedException();
    const secret = this.config.get<string>(`payment.${provider.toLowerCase()}.secretKey`, '');
    if (!secret) throw new WebhookVerificationFailedException();

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signatureHeader);
    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      throw new WebhookVerificationFailedException();
    }
  }

  async handleWebhook(provider: PaymentProvider, payload: WebhookPayload, rawBody: Buffer, signatureHeader?: string) {
    this.verifyWebhookSignature(provider, rawBody, signatureHeader);
    this.assertPayloadShape(payload);

    try {
      await this.db.paymentWebhookEvent.create({
        data: { provider, eventId: payload.eventId, payload: payload as unknown as Prisma.InputJsonValue },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.log(`Takroriy webhook hodisasi e’tiborsiz qoldirildi: ${provider}/${payload.eventId}`);
        return { deduplicated: true };
      }
      throw error;
    }

    const payment = await this.db.payment.findUnique({ where: { id: payload.paymentId } });
    if (!payment) {
      // Obuna to‘lovi bo‘lishi mumkin (paymentId — obuna ID si): muvaffaqiyatli bo‘lsa obuna avtomatik faollashadi.
      if (provider === 'UZUM' || provider === 'CLICK' || provider === 'PAYME') {
        const outcome = await this.subscriptions.gatewayWebhook(provider, { subscriptionId: payload.paymentId, status: payload.status, amount: payload.amount, currency: payload.currency, providerPaymentId: payload.providerPaymentId, failureReason: payload.failureReason });
        if (outcome.found) {
          await this.db.paymentWebhookEvent.update({ where: { provider_eventId: { provider, eventId: payload.eventId } }, data: { processedAt: new Date() } });
          if (outcome.mismatch) {
            await this.auditMismatch(provider, payload, 'SUBSCRIPTION_AMOUNT_OR_CURRENCY_MISMATCH');
            throw new WebhookVerificationFailedException();
          }
          return { subscription: true };
        }
      }
      await this.auditMismatch(provider, payload, 'PAYMENT_NOT_FOUND');
      throw new WebhookVerificationFailedException();
    }
    if (Number(payment.amount) !== payload.amount || payment.currency !== payload.currency) {
      await this.auditMismatch(provider, payload, 'AMOUNT_OR_CURRENCY_MISMATCH');
      throw new WebhookVerificationFailedException();
    }

    const outcome = await this.db.$transaction(async (tx) => {
      const changed = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data:
          payload.status === 'SUCCEEDED'
            ? { status: 'SUCCEEDED', providerPaymentId: payload.providerPaymentId, succeededAt: new Date() }
            : { status: 'FAILED', failureReason: payload.failureReason, failedAt: new Date() },
      });

      await tx.paymentWebhookEvent.update({
        where: { provider_eventId: { provider, eventId: payload.eventId } },
        data: { processedAt: new Date() },
      });

      if (changed.count === 0) return { applied: false as const };

      const result = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
      await this.outbox.emit(tx, {
        eventName: payload.status === 'SUCCEEDED' ? 'payment.succeeded' : 'payment.failed',
        aggregateType: 'Payment',
        aggregateId: result.id,
        payload: { paymentId: result.id, orderId: result.orderId, customerId: result.customerId },
      });
      if (payload.status === 'SUCCEEDED') {
        const order = await tx.order.findUniqueOrThrow({ where: { id: result.orderId }, select: { master: { select: { userId: true } } } });
        await this.outbox.emit(tx, {
          eventName: 'payment.received',
          aggregateType: 'Payment',
          aggregateId: result.id,
          payload: { paymentId: result.id, orderId: result.orderId, masterUserId: order.master.userId, provider: result.provider, amount: String(result.amount), currency: result.currency },
        });
      }
      return { applied: true as const, payment: result };
    });

    if (!outcome.applied) {
      await this.auditMismatch(provider, payload, 'PAYMENT_ALREADY_FINAL');
      return { ignored: true };
    }
    if (payload.status === 'FAILED') this.metrics.paymentFailed(provider);
    return { payment: outcome.payment };
  }

  private assertPayloadShape(payload: unknown): asserts payload is WebhookPayload {
    const p = payload as Partial<WebhookPayload> | null;
    const isUuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    if (
      !p ||
      typeof p.eventId !== 'string' ||
      p.eventId.length === 0 ||
      p.eventId.length > 255 ||
      !isUuid(p.paymentId) ||
      (p.status !== 'SUCCEEDED' && p.status !== 'FAILED') ||
      typeof p.amount !== 'number' ||
      !Number.isFinite(p.amount) ||
      typeof p.currency !== 'string' ||
      p.currency.length !== 3
    ) {
      throw new BadRequestException(ERRORS.MALFORMED_WEBHOOK);
    }
  }

  private async auditMismatch(provider: PaymentProvider, payload: WebhookPayload, reason: string) {
    this.logger.warn(`Webhook ma’lumotlari mos kelmadi [${provider}] ${reason}: ${JSON.stringify(payload)}`);
    await this.db.auditLog.create({
      data: {
        action: 'PAYMENT_WEBHOOK_MISMATCH',
        targetType: 'Payment',
        targetId: payload.paymentId,
        reason,
        after: payload as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
