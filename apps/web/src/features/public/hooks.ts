import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { publicService } from './public.service';

export function usePublicMasters(categoryId: string, q: string, mode = '') {
  return useInfiniteQuery({
    queryKey: ['public', 'masters', categoryId, q, mode],
    queryFn: ({ pageParam }) => publicService.masters({ categoryId: categoryId || undefined, q, mode: mode || undefined, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function usePublicStats() {
  return useQuery({ queryKey: ['public', 'stats'], queryFn: () => publicService.stats(), staleTime: 5 * 60_000 });
}

export function usePublicPlans() {
  return useQuery({ queryKey: ['public', 'plans'], queryFn: () => publicService.plans(), staleTime: 10 * 60_000 });
}

export function usePublicPrices() {
  return useQuery({ queryKey: ['public', 'prices'], queryFn: () => publicService.prices(), staleTime: 5 * 60_000 });
}
