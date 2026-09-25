import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { offerService } from '../services/offer.service';
import type { CreateOfferInput, OpenRequestScope } from '../types';

export function useRequestOffers(requestId: string, enabled = true) {
  return useQuery({
    queryKey: ['offers', 'request', requestId],
    queryFn: () => offerService.listForRequest(requestId),
    enabled: !!requestId && enabled,
    refetchInterval: 30_000,
  });
}

export function useOpenRequests(scope: OpenRequestScope) {
  return useInfiniteQuery({
    queryKey: ['offers', 'open', scope],
    queryFn: ({ pageParam }: { pageParam?: string }) => offerService.listOpenRequests(scope, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: 30_000,
  });
}

export function useMyOffers() {
  return useQuery({ queryKey: ['offers', 'mine'], queryFn: () => offerService.listMine() });
}

export function useIncomingRequests() {
  return useQuery({
    queryKey: ['offers', 'incoming'],
    queryFn: () => offerService.listIncomingRequests(),
    refetchInterval: 30_000,
  });
}

export function useCreateOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOfferInput) => offerService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['offers'] }),
  });
}

export function useWithdrawOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (offerId: string) => offerService.withdraw(offerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['offers'] }),
  });
}

export function useAcceptOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, idempotencyKey }: { offerId: string; idempotencyKey: string }) =>
      offerService.accept(offerId, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void queryClient.invalidateQueries({ queryKey: ['offers'] });
    },
  });
}
