import { useMutation, useQuery } from '@tanstack/react-query';
import type { PaymentProvider } from '@/types/common';
import { paymentService } from '../services/payment.service';

export function useCreatePayment() {
  return useMutation({
    mutationFn: ({ orderId, provider, idempotencyKey }: { orderId: string; provider: PaymentProvider; idempotencyKey: string }) =>
      paymentService.create(orderId, provider, idempotencyKey),
  });
}

export function usePayment(id: string | null) {
  return useQuery({
    queryKey: ['payments', id],
    queryFn: () => paymentService.get(id as string),
    enabled: !!id,
  });
}

export function usePaymentHistory() {
  return useQuery({ queryKey: ['payments', 'history'], queryFn: () => paymentService.history() });
}

export function useEarnings(range: { dateFrom?: string; dateTo?: string }) {
  return useQuery({ queryKey: ['payments', 'earnings', range], queryFn: () => paymentService.earnings(range) });
}
