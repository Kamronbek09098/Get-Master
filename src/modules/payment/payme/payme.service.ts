import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service';
import { MetricsService } from '../../../infrastructure/metrics/metrics.service';
import { PAYME_TRANSACTION_TIMEOUT_MS, PaymeError, PaymeMetadata, PaymeRpcRequest, PaymeRpcResponse, PaymeState } from './payme.types';

const AMOUNT_EPSILON_TIYIN = 1;

/**
 * Payme Merchant API (JSON-RPC 2.0, https://developer.help.paycom.uz):
 * bitta URL orqali CheckPerformTransaction/CreateTransaction/PerformTransaction/
 * CancelTransaction/CheckTransaction/GetStatement metodlarini qabul qiladi.
 * Har doim HTTP 200 va JSON-RPC shaklidagi { result } yoki { error } qaytariladi.
 */
@Injectable()
export class PaymeService {
  private readonly logger = new Logger(PaymeService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
    private readonly metrics: MetricsService,
  ) {}

  isConfigured(): boolean {
    return !!(this.config.get<string>('payment.payme.merchantId') && this.config.get<string>('payment.payme.secretKey'));
  }

  checkAuth(authHeader: string | undefined): boolean {
    const secret = this.config.get<string>('payment.payme.secretKey', '');
    if (!secret || !authHeader?.startsWith('Basic ')) return false;
    let decoded: string;
    try {
      decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    } catch {
      return false;
    }
    const separator = decoded.indexOf(':');
    if (separator === -1) return false;
    const login = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    return login === 'Paycom' && password === secret;
  }

  buildCheckoutUrl(payment: { id: string; amount: Prisma.Decimal | number | string }): string {
    const merchantId = this.config.get<string>('payment.payme.merchantId', '');
    const testMode = this.config.get<boolean>('payment.payme.testMode', true);
    const amountTiyin = Math.round(Number(payment.amount) * 100);
    const raw = `m=${merchantId};ac.order_id=${payment.id};a=${amountTiyin}`;
    const encoded = Buffer.from(raw).toString('base64');
    const host = testMode ? 'checkout.test.paycom.uz' : 'checkout.paycom.uz';
    return `https://${host}/${encoded}`;
  }

  async handleRpc(body: PaymeRpcRequest, authHeader: string | undefined): Promise<PaymeRpcResponse> {
    const id = body?.id ?? null;
    if (!this.checkAuth(authHeader)) {
      return this.error(id, PaymeError.INSUFFICIENT_PRIVILEGE, 'Ruxsat yo‘q', 'Недостаточно привилегий', 'Insufficient privilege');
    }
    if (!body || typeof body.method !== 'string') {
      return this.error(id, PaymeError.INVALID_REQUEST, 'Noto‘g‘ri so‘rov', 'Неверный запрос', 'Invalid request');
    }
    const params = (body.params ?? {}) as Record<string, unknown>;
    try {
      switch (body.method) {
        case 'CheckPerformTransaction':
          return await this.checkPerformTransaction(id, params);
        case 'CreateTransaction':
          return await this.createTransaction(id, params);
        case 'PerformTransaction':
          return await this.performTransaction(id, params);
        case 'CancelTransaction':
          return await this.cancelTransaction(id, params);
        case 'CheckTransaction':
          return await this.checkTransaction(id, params);
        case 'GetStatement':
          return await this.getStatement(id, params);
        default:
          return this.error(id, PaymeError.METHOD_NOT_FOUND, 'Metod topilmadi', 'Метод не найден', 'Method not found');
      }
    } catch (err) {
      this.logger.error(`Payme RPC xatosi [${body.method}]: ${(err as Error).message}`, (err as Error).stack);
      return this.error(id, PaymeError.INTERNAL_ERROR, 'Ichki xatolik', 'Внутренняя ошибка', 'Internal error');
    }
  }

  private result(id: number | string | null, result: Record<string, unknown>): PaymeRpcResponse {
    return { jsonrpc: '2.0', id, result };
  }

  private error(id: number | string | null, code: number, uz: string, ru: string, en: string, data?: string): PaymeRpcResponse {
    return { jsonrpc: '2.0', id, error: { code, message: { uz, ru, en }, ...(data ? { data } : {}) } };
  }

  private orderNotFound(id: number | string | null) {
    return this.error(id, PaymeError.ORDER_NOT_FOUND, 'Buyurtma topilmadi', 'Заказ не найден', 'Order not found', 'order_id');
  }

  private invalidAmount(id: number | string | null) {
    return this.error(id, PaymeError.INVALID_AMOUNT, 'Summa noto‘g‘ri', 'Неверная сумма', 'Incorrect amount', 'amount');
  }

  private cantPerform(id: number | string | null) {
    return this.error(id, PaymeError.CANT_PERFORM, 'Amalni bajarib bo‘lmaydi', 'Невозможно выполнить операцию', 'Unable to perform operation');
  }

  private transactionNotFound(id: number | string | null) {
    return this.error(id, PaymeError.TRANSACTION_NOT_FOUND, 'Tranzaksiya topilmadi', 'Транзакция не найдена', 'Transaction not found');
  }

  private async findPayableOrder(accountOrderId: unknown, amount: unknown) {
    if (typeof accountOrderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(accountOrderId)) return { error: 'account' as const };
    const payment = await this.db.payment.findFirst({ where: { id: accountOrderId, provider: 'PAYME' } });
    if (!payment) return { error: 'account' as const };
    if (payment.status !== 'PENDING' && payment.status !== 'PROCESSING') return { error: 'state' as const, payment };
    const amountTiyin = Math.round(Number(payment.amount) * 100);
    if (typeof amount !== 'number' || Math.abs(amount - amountTiyin) > AMOUNT_EPSILON_TIYIN) return { error: 'amount' as const, payment };
    return { payment };
  }

  private async checkPerformTransaction(id: number | string | null, params: Record<string, unknown>) {
    const account = params.account as Record<string, unknown> | undefined;
    const lookup = await this.findPayableOrder(account?.order_id, params.amount);
    if (lookup.error === 'account') return this.orderNotFound(id);
    if (lookup.error === 'amount') return this.invalidAmount(id);
    if (lookup.error === 'state') return this.cantPerform(id);
    return this.result(id, { allow: true });
  }

  private async createTransaction(id: number | string | null, params: Record<string, unknown>) {
    const paymeId = params.id;
    if (typeof paymeId !== 'string' || !paymeId) return this.error(id, PaymeError.INVALID_REQUEST, 'Noto‘g‘ri so‘rov', 'Неверный запрос', 'Invalid request');

    const existing = await this.db.payment.findFirst({ where: { provider: 'PAYME', providerPaymentId: paymeId } });
    if (existing) {
      const meta = (existing.metadata as { payme?: PaymeMetadata } | null)?.payme;
      if (!meta) return this.transactionNotFound(id);
      if (meta.state === PaymeState.CREATED && Date.now() - meta.createTime > PAYME_TRANSACTION_TIMEOUT_MS) {
        await this.markCancelled(existing.id, meta, PaymeState.CANCELLED, 4);
        return this.cantPerform(id);
      }
      return this.result(id, { create_time: meta.createTime, transaction: existing.id, state: meta.state });
    }

    const account = params.account as Record<string, unknown> | undefined;
    const lookup = await this.findPayableOrder(account?.order_id, params.amount);
    if (lookup.error === 'account') return this.orderNotFound(id);
    if (lookup.error === 'amount') return this.invalidAmount(id);
    if (lookup.error === 'state') return this.cantPerform(id);

    const payment = lookup.payment;
    const otherActive = await this.db.payment.findFirst({
      where: { orderId: payment.orderId, provider: 'PAYME', status: { in: ['PROCESSING', 'SUCCEEDED'] }, id: { not: payment.id } },
    });
    if (otherActive) return this.cantPerform(id);

    const createTime = Date.now();
    const meta: PaymeMetadata = { transactionId: paymeId, createTime, state: PaymeState.CREATED };
    await this.db.payment.update({
      where: { id: payment.id },
      data: { status: 'PROCESSING', providerPaymentId: paymeId, metadata: { ...(payment.metadata as object | null), payme: meta } as unknown as Prisma.InputJsonValue },
    });
    return this.result(id, { create_time: createTime, transaction: payment.id, state: PaymeState.CREATED });
  }

  private async performTransaction(id: number | string | null, params: Record<string, unknown>) {
    const paymeId = params.id;
    if (typeof paymeId !== 'string') return this.transactionNotFound(id);
    const payment = await this.db.payment.findFirst({ where: { provider: 'PAYME', providerPaymentId: paymeId } });
    if (!payment) return this.transactionNotFound(id);
    const meta = (payment.metadata as { payme?: PaymeMetadata } | null)?.payme;
    if (!meta) return this.transactionNotFound(id);

    if (meta.state === PaymeState.COMPLETED) {
      return this.result(id, { transaction: payment.id, perform_time: meta.performTime, state: PaymeState.COMPLETED });
    }
    if (meta.state !== PaymeState.CREATED) return this.cantPerform(id);
    if (Date.now() - meta.createTime > PAYME_TRANSACTION_TIMEOUT_MS) {
      await this.markCancelled(payment.id, meta, PaymeState.CANCELLED, 4);
      return this.cantPerform(id);
    }

    const performTime = Date.now();
    const nextMeta: PaymeMetadata = { ...meta, state: PaymeState.COMPLETED, performTime };
    await this.db.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCEEDED', succeededAt: new Date(performTime), metadata: { ...(payment.metadata as object | null), payme: nextMeta } as unknown as Prisma.InputJsonValue },
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
    return this.result(id, { transaction: payment.id, perform_time: performTime, state: PaymeState.COMPLETED });
  }

  private async cancelTransaction(id: number | string | null, params: Record<string, unknown>) {
    const paymeId = params.id;
    const reason = typeof params.reason === 'number' ? params.reason : 0;
    if (typeof paymeId !== 'string') return this.transactionNotFound(id);
    const payment = await this.db.payment.findFirst({ where: { provider: 'PAYME', providerPaymentId: paymeId } });
    if (!payment) return this.transactionNotFound(id);
    const meta = (payment.metadata as { payme?: PaymeMetadata } | null)?.payme;
    if (!meta) return this.transactionNotFound(id);

    if (meta.state === PaymeState.CANCELLED || meta.state === PaymeState.CANCELLED_AFTER_COMPLETE) {
      return this.result(id, { transaction: payment.id, cancel_time: meta.cancelTime, state: meta.state });
    }

    const nextState = meta.state === PaymeState.COMPLETED ? PaymeState.CANCELLED_AFTER_COMPLETE : PaymeState.CANCELLED;
    const cancelTime = await this.markCancelled(payment.id, meta, nextState, reason);
    if (nextState === PaymeState.CANCELLED) this.metrics.paymentFailed('PAYME');
    return this.result(id, { transaction: payment.id, cancel_time: cancelTime, state: nextState });
  }

  private async markCancelled(paymentId: string, meta: PaymeMetadata, state: number, reason: number): Promise<number> {
    const cancelTime = Date.now();
    const nextMeta: PaymeMetadata = { ...meta, state, cancelTime, reason };
    await this.db.payment.update({
      where: { id: paymentId },
      data: {
        status: state === PaymeState.CANCELLED_AFTER_COMPLETE ? 'CANCELLED' : 'FAILED',
        failedAt: new Date(cancelTime),
        failureReason: `Payme cancel reason=${reason}`,
        metadata: { payme: nextMeta } as unknown as Prisma.InputJsonValue,
      },
    });
    return cancelTime;
  }

  private async checkTransaction(id: number | string | null, params: Record<string, unknown>) {
    const paymeId = params.id;
    if (typeof paymeId !== 'string') return this.transactionNotFound(id);
    const payment = await this.db.payment.findFirst({ where: { provider: 'PAYME', providerPaymentId: paymeId } });
    if (!payment) return this.transactionNotFound(id);
    const meta = (payment.metadata as { payme?: PaymeMetadata } | null)?.payme;
    if (!meta) return this.transactionNotFound(id);
    return this.result(id, {
      create_time: meta.createTime,
      perform_time: meta.performTime ?? 0,
      cancel_time: meta.cancelTime ?? 0,
      transaction: payment.id,
      state: meta.state,
      reason: meta.reason ?? null,
    });
  }

  private async getStatement(id: number | string | null, params: Record<string, unknown>) {
    const from = Number(params.from ?? 0);
    const to = Number(params.to ?? Date.now());
    const rows = await this.db.payment.findMany({
      where: { provider: 'PAYME', createdAt: { gte: new Date(from), lte: new Date(to) } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    const transactions = rows
      .map((row) => {
        const meta = (row.metadata as { payme?: PaymeMetadata } | null)?.payme;
        if (!meta) return null;
        return {
          id: meta.transactionId,
          time: meta.createTime,
          amount: Math.round(Number(row.amount) * 100),
          account: { order_id: row.id },
          create_time: meta.createTime,
          perform_time: meta.performTime ?? 0,
          cancel_time: meta.cancelTime ?? 0,
          transaction: row.id,
          state: meta.state,
          reason: meta.reason ?? null,
        };
      })
      .filter((tx): tx is NonNullable<typeof tx> => tx !== null);
    return this.result(id, { transactions });
  }
}
