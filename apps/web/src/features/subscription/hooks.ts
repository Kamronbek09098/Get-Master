import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { subscriptionService } from './subscription.service';
import type { PayMethod, PlanCode, SubscriptionStatus } from './types';

export function usePlans() {
  return useQuery({ queryKey: ['subscriptions', 'plans'], queryFn: () => subscriptionService.plans(), staleTime: 10 * 60_000 });
}

export function useMySubscriptions() {
  const hasSession = useAuthStore((state) => state.hasSession);
  return useQuery({
    queryKey: ['subscriptions', 'me'],
    queryFn: () => subscriptionService.me(),
    enabled: hasSession,
    staleTime: 60_000,
    // Onlayn to‘lov kutilayotgan bo‘lsa, obuna faollashishi bilan sahifa o‘zi yangilanadi.
    refetchInterval: (query) => (query.state.data?.pending.some((row) => row.method !== 'CARD') ? 4_000 : false),
  });
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

export function useAdminSubscriptions(status: SubscriptionStatus | '', page: number, q = '', method = '') {
  return useQuery({ queryKey: ['admin', 'subscriptions', status, page, q, method], queryFn: () => subscriptionService.adminList(status, page, q, method), refetchInterval: 30_000 });
}

export function useAdminSubscriptionSummary() {
  return useQuery({ queryKey: ['admin', 'subscriptions', 'summary'], queryFn: () => subscriptionService.adminSummary(), refetchInterval: 60_000 });
}

export function useAttachReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mediaAssetId }: { id: string; mediaAssetId: string }) => subscriptionService.attachReceipt(id, mediaAssetId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions', 'me'] }),
  });
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

/** Sovg‘a uchun foydalanuvchi qidiruvi: bo‘sh so‘rovda — ro‘yxatdan o‘tgan sana bo‘yicha yangilari tepada. */
export function useSubscriptionUserSearch(q: string, audience: 'CUSTOMER' | 'MASTER', enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['admin', 'subscription-users', q, audience],
    queryFn: ({ pageParam }) => subscriptionService.searchUsers(q, audience, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}
