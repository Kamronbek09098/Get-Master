import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { subscriptionService } from './subscription.service';
import type { PayMethod, PlanCode, SubscriptionStatus } from './types';

export function usePlans() {
  return useQuery({ queryKey: ['subscriptions', 'plans'], queryFn: () => subscriptionService.plans(), staleTime: 10 * 60_000 });
}

export function useMySubscriptions() {
  const hasSession = useAuthStore((state) => state.hasSession);
  return useQuery({ queryKey: ['subscriptions', 'me'], queryFn: () => subscriptionService.me(), enabled: hasSession, staleTime: 60_000 });
}

/** Mijoz «Plus» obunasi hozir faolmi (chatda o‘chirilgan xabarlarni ko‘rish va h.k.). */
export function useHasPlus(): boolean {
  const me = useMySubscriptions();
  return !!me.data?.customer;
}

export function useRequestSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { planCode: PlanCode; months: number; method: PayMethod }) => subscriptionService.request(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions', 'me'] }),
  });
}

export function useCancelSubscriptionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => subscriptionService.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions', 'me'] }),
  });
}

export function useAdminSubscriptions(status: SubscriptionStatus | '', page: number) {
  return useQuery({ queryKey: ['admin', 'subscriptions', status, page], queryFn: () => subscriptionService.adminList(status, page), refetchInterval: 30_000 });
}

export function useAdminSubscriptionActions() {
  const queryClient = useQueryClient();
  const done = () => queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
  return {
    approve: useMutation({ mutationFn: (id: string) => subscriptionService.approve(id), onSuccess: done }),
    reject: useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => subscriptionService.reject(id, reason), onSuccess: done }),
    revoke: useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => subscriptionService.revoke(id, reason), onSuccess: done }),
    grant: useMutation({ mutationFn: (input: Parameters<typeof subscriptionService.grant>[0]) => subscriptionService.grant(input), onSuccess: done }),
  };
}
