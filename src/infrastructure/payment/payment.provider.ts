import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider as PaymentProviderEnum } from '@prisma/client';
import { ERRORS } from '../../common/constants/error-messages';

export interface CreateProviderPaymentInput {
  provider: PaymentProviderEnum;
  amount: number;
  currency: string;
  orderId: string;
}

export interface CreateProviderPaymentResult {
  providerPaymentId: string;
  redirectUrl?: string;
}

export interface VerifyProviderPaymentResult {
  providerPaymentId: string;
  succeeded: boolean;
}

@Injectable()
export class PaymentProviderAdapter {
  private readonly logger = new Logger(PaymentProviderAdapter.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('payment.baseUrl');
  }

  createPayment(input: CreateProviderPaymentInput): Promise<CreateProviderPaymentResult> {
    return this.request<CreateProviderPaymentResult>('/payments', { method: 'POST', body: JSON.stringify(input) });
  }

  verifyPayment(providerPaymentId: string): Promise<VerifyProviderPaymentResult> {
    return this.request<VerifyProviderPaymentResult>(`/payments/${encodeURIComponent(providerPaymentId)}`, { method: 'GET' });
  }

  refund(providerPaymentId: string, amount: number): Promise<{ providerRefundId: string }> {
    return this.request<{ providerRefundId: string }>(`/payments/${encodeURIComponent(providerPaymentId)}/refund`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  private async request<T>(path: string, init: { method: string; body?: string }): Promise<T> {
    const baseUrl = this.config.get<string>('payment.baseUrl');
    if (!baseUrl) throw new Error(ERRORS.PAYMENT_PROVIDER_NOT_CONFIGURED);
    const apiKey = this.config.get<string>('payment.apiKey', '');

    const response = await fetch(`${baseUrl}${path}`, {
      method: init.method,
      body: init.body,
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    });
    if (!response.ok) {
      this.logger.error(`To‘lov provayderi so‘rovi bajarilmadi: ${init.method} ${path} -> ${response.status}`);
      throw new Error(ERRORS.PAYMENT_PROVIDER_FAILED(response.status));
    }
    return (await response.json()) as T;
  }
}
