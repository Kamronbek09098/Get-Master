import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export function useConfirmCash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => paymentService.confirmCash(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

export function useEarningsOverview(days: number) {
  return useQuery({ queryKey: ['payments', 'earnings-overview', days], queryFn: () => paymentService.earningsOverview(days), refetchInterval: 30_000 });
}
