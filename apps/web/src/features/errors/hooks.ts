import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorLogService } from './service';
import type { ErrorFilters } from './types';

export function useErrorSummary() {
  return useQuery({ queryKey: ['admin', 'errors', 'summary'], queryFn: () => errorLogService.summary(), refetchInterval: 30_000 });
}

export function useErrorGroups(days: number, enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'errors', 'groups', days],
    queryFn: () => errorLogService.groups(days),
    enabled,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useErrorList(filters: ErrorFilters, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['admin', 'errors', 'list', filters],
    queryFn: ({ pageParam }: { pageParam: number }) => errorLogService.list(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
    enabled,
    refetchInterval: 30_000,
  });
}

export function useResolveErrors() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, fingerprint, value }: { ids?: string[]; fingerprint?: string; value: boolean }) => errorLogService.resolve({ ids, fingerprint }, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'errors'] }),
  });
}
