import type { PaymentProvider, PaymentStatus } from '@/types/common';

export interface Payment {
  id: string;
  orderId: string;
  customerId: string;
  provider: PaymentProvider;
  providerPaymentId: string | null;
  amount: string;
  refundedAmount: string;
  currency: string;
  status: PaymentStatus;
  failureReason: string | null;
  succeededAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentResult {
  payment: Payment;
  checkoutUrl: string;
}

export interface EarningsSummary {
  grossAmount: string;
  refundedAmount: string;
  netAmount: string;
  paymentCount: number;
}
