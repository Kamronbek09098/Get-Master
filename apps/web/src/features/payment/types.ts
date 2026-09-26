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
  checkoutUrl: string | null;
}

export interface EarningsSummary {
  grossAmount: string;
  refundedAmount: string;
  netAmount: string;
  paymentCount: number;
}

export interface EarningsDay {
  date: string;
  net: number;
  gross: number;
  count: number;
}

export interface EarningsOverview {
  currency: string;
  today: { date: string; net: number; count: number; yesterday: number };
  week: { net: number; count: number };
  month: { net: number; count: number };
  all: { net: number; count: number };
  pending: { amount: number; count: number };
  range: { days: number; net: number; average: number; bestDay: EarningsDay | null };
  daily: EarningsDay[];
  providers: Array<{ provider: string; net: number; count: number }>;
}
