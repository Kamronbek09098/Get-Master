import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service';
import { MetricsService } from '../../../infrastructure/metrics/metrics.service';
import { ClickCallbackBody, ClickCallbackResponse, ClickError, ClickErrorNote } from './click.types';

const AMOUNT_EPSILON = 0.01;

interface ClickMetadata {
  clickTransId: string;
  prepareId: number;
  prepareTime: number;
}

/**
 * Click Merchant API v2 (https://docs.click.uz): bitta callback URL orqali
 * Prepare (action=0) va Complete (action=1) so'rovlarini qabul qiladi.
 * Har doim HTTP 200 va { error, error_note } shaklidagi javob qaytariladi —
 * Click bu qatlamda boshqa status kodlarini tushunmaydi.
 */
@Injectable()
export class ClickService {
  private readonly logger = new Logger(ClickService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
    private readonly metrics: MetricsService,
  ) {}

  isConfigured(): boolean {
    return !!(
      this.config.get<string>('payment.click.merchantId') &&
      this.config.get<string>('payment.click.serviceId') &&
      this.config.get<string>('payment.click.secretKey')
    );
  }

  buildCheckoutUrl(payment: { id: string; amount: Prisma.Decimal | number | string }): string {
    const merchantId = this.config.get<string>('payment.click.merchantId', '');
    const serviceId = this.config.get<string>('payment.click.serviceId', '');
    const returnUrl = this.config.get<string>('payment.returnUrl', '');
    const amount = Number(payment.amount).toFixed(2);
    const params = new URLSearchParams({
      service_id: serviceId,
      merchant_id: merchantId,
      amount,
      transaction_param: payment.id,
      ...(returnUrl ? { return_url: returnUrl } : {}),
    });
    return `https://my.click.uz/services/pay?${params.toString()}`;
  }

  async handleCallback(body: ClickCallbackBody): Promise<ClickCallbackResponse> {
    const action = Number(body.action);
    if (action === 0) return this.prepare(body);
    if (action === 1) return this.complete(body);
    return this.fail(ClickError.ACTION_NOT_FOUND, body);
  }

  private sign(body: ClickCallbackBody, action: number): string {
    const secretKey = this.config.get<string>('payment.click.secretKey', '');
    const parts =
      action === 0
        ? [body.click_trans_id, body.service_id, secretKey, body.merchant_trans_id, body.amount, body.action, body.sign_time]
        : [
            body.click_trans_id,
            body.service_id,
            secretKey,
            body.merchant_trans_id,
            body.merchant_prepare_id,
            body.amount,
            body.action,
            body.sign_time,
          ];
    return createHash('md5').update(parts.join('')).digest('hex');
  }

  private fail(code: number, body: ClickCallbackBody): ClickCallbackResponse {
    return {
      click_trans_id: body.click_trans_id,
      merchant_trans_id: body.merchant_trans_id,
      error: code,
      error_note: ClickErrorNote[code] ?? 'Error',
    };
  }

  private async prepare(body: ClickCallbackBody): Promise<ClickCallbackResponse> {
    if (!this.isConfigured()) return this.fail(ClickError.REQUEST_ERROR, body);
    if (!body.merchant_trans_id || !body.sign_string || !body.sign_time) return this.fail(ClickError.REQUEST_ERROR, body);
    if (this.sign(body, 0) !== body.sign_string) return this.fail(ClickError.SIGN_FAILED, body);

    const payment = await this.db.payment.findFirst({ where: { id: body.merchant_trans_id, provider: 'CLICK' } });
    if (!payment) return this.fail(ClickError.ORDER_NOT_FOUND, body);
    if (Math.abs(Number(payment.amount) - Number(body.amount)) > AMOUNT_EPSILON) return this.fail(ClickError.AMOUNT_INVALID, body);
    if (payment.status === 'SUCCEEDED') return this.fail(ClickError.ALREADY_PAID, body);
    if (payment.status !== 'PENDING' && payment.status !== 'PROCESSING') return this.fail(ClickError.TRANSACTION_CANCELLED, body);

    const meta = (payment.metadata as { click?: ClickMetadata } | null)?.click;
    const clickTransId = String(body.click_trans_id);
    const prepareId = meta?.clickTransId === clickTransId ? meta.prepareId : Date.now();

    if (!meta || meta.clickTransId !== clickTransId) {
      await this.db.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PROCESSING',
          metadata: { ...(payment.metadata as object | null), click: { clickTransId, prepareId, prepareTime: Date.now() } satisfies ClickMetadata },
        },
      });
    }

    return {
      click_trans_id: body.click_trans_id,
      merchant_trans_id: body.merchant_trans_id,
      merchant_prepare_id: prepareId,
      error: ClickError.SUCCESS,
      error_note: ClickErrorNote[ClickError.SUCCESS],
    };
  }

  private async complete(body: ClickCallbackBody): Promise<ClickCallbackResponse> {
    if (!this.isConfigured()) return this.fail(ClickError.REQUEST_ERROR, body);
    if (!body.merchant_trans_id || !body.sign_string || !body.sign_time) return this.fail(ClickError.REQUEST_ERROR, body);
    if (this.sign(body, 1) !== body.sign_string) return this.fail(ClickError.SIGN_FAILED, body);

    const payment = await this.db.payment.findFirst({ where: { id: body.merchant_trans_id, provider: 'CLICK' } });
    if (!payment) return this.fail(ClickError.ORDER_NOT_FOUND, body);

    // Click o'z tomonida to'lovni bekor qilgan bo'lsa (masalan karta rad etilgan), shuni bildiradi — bizdan faqat qabul qilganimizni tasdiqlash kutiladi.
    if (Number(body.error ?? 0) < 0) {
      if (payment.status !== 'SUCCEEDED') {
        await this.db.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: body.error_note ?? 'Click tomonidan bekor qilindi', failedAt: new Date() } });
        this.metrics.paymentFailed('CLICK');
      }
      return { click_trans_id: body.click_trans_id, merchant_trans_id: body.merchant_trans_id, merchant_confirm_id: undefined, error: ClickError.SUCCESS, error_note: ClickErrorNote[ClickError.SUCCESS] };
    }

    const meta = (payment.metadata as { click?: ClickMetadata } | null)?.click;
    const clickTransId = String(body.click_trans_id);
    if (!meta || meta.clickTransId !== clickTransId || String(meta.prepareId) !== String(body.merchant_prepare_id)) {
      return this.fail(ClickError.TRANSACTION_NOT_FOUND, body);
    }
    if (Math.abs(Number(payment.amount) - Number(body.amount)) > AMOUNT_EPSILON) return this.fail(ClickError.AMOUNT_INVALID, body);

    if (payment.status === 'SUCCEEDED') {
      return {
        click_trans_id: body.click_trans_id,
        merchant_trans_id: body.merchant_trans_id,
        merchant_confirm_id: meta.prepareId,
        error: ClickError.SUCCESS,
        error_note: ClickErrorNote[ClickError.SUCCESS],
      };
    }

    await this.db.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCEEDED', providerPaymentId: clickTransId, succeededAt: new Date() },
      });
      await this.outbox.emit(tx, {
        eventName: 'payment.succeeded',
        aggregateType: 'Payment',
        aggregateId: updated.id,
        payload: { paymentId: updated.id, orderId: updated.orderId, customerId: updated.customerId },
      });
      const order = await tx.order.findUniqueOrThrow({ where: { id: updated.orderId }, select: { master: { select: { userId: true } } } });
      await this.outbox.emit(tx, {
        eventName: 'payment.received',
        aggregateType: 'Payment',
        aggregateId: updated.id,
        payload: { paymentId: updated.id, orderId: updated.orderId, masterUserId: order.master.userId, provider: updated.provider, amount: String(updated.amount), currency: updated.currency },
      });
    });

    return {
      click_trans_id: body.click_trans_id,
      merchant_trans_id: body.merchant_trans_id,
      merchant_confirm_id: meta.prepareId,
      error: ClickError.SUCCESS,
      error_note: ClickErrorNote[ClickError.SUCCESS],
    };
  }
}
