import { apiGet, apiPost } from '@/services/api.client';
import type { PaymentProvider } from '@/types/common';
import type { CursorPage } from '@/types/api';
import type { CreatePaymentResult, EarningsOverview, EarningsSummary, Payment } from '../types';

export const paymentService = {
  history(cursor?: string) {
    return apiGet<CursorPage<Payment>>(`/payments/history${cursor ? `?cursor=${cursor}` : ''}`);
  },
  earnings(params: { dateFrom?: string; dateTo?: string } = {}) {
    const search = new URLSearchParams();
    if (params.dateFrom) search.set('dateFrom', params.dateFrom);
    if (params.dateTo) search.set('dateTo', params.dateTo);
    const query = search.toString();
    return apiGet<{ summary: EarningsSummary } & CursorPage<Payment>>(`/payments/earnings${query ? `?${query}` : ''}`);
  },
  earningsOverview(days: number) {
    return apiGet<EarningsOverview>(`/payments/earnings/overview?days=${days}`);
  },
  refund(id: string, input: { amount: number; reason: string; note: string }, idempotencyKey: string) {
    return apiPost<unknown>(`/payments/${id}/refund`, input, idempotencyKey);
  },
  create(orderId: string, provider: PaymentProvider, idempotencyKey: string) {
    return apiPost<CreatePaymentResult>('/payments', { orderId, provider }, idempotencyKey);
  },
  confirmCash(id: string) {
    return apiPost<Payment>(`/payments/${id}/confirm-cash`);
  },
  get(id: string) {
    return apiGet<Payment>(`/payments/${id}`);
  },
};
