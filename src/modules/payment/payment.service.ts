import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { EarningsQueryDto } from './dto/earnings-query.dto';
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

      const pending = await tx.payment.findFirst({
        where: { orderId: order.id, provider: dto.provider, status: 'PENDING' },
      });
      if (pending) return pending;

      const full = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
      return tx.payment.create({
        data: {
          orderId: order.id,
          customerId,
          provider: dto.provider,
          amount: full.finalAmount,
          currency: full.currency,
          status: 'PENDING',
        },
      });
    });

    return { payment, checkoutUrl: `https://payment.example/checkout/${payment.id}` };
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
