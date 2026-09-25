import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestService } from '../services/request.service';
import type { CreateRequestInput } from '../types';

export function useMyRequests() {
  return useInfiniteQuery({
    queryKey: ['requests', 'mine'],
    queryFn: ({ pageParam }: { pageParam?: string }) => requestService.listMine({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useRequest(id: string) {
  return useQuery({ queryKey: ['requests', id], queryFn: () => requestService.get(id), enabled: !!id });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRequestInput) => requestService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requests', 'mine'] }),
  });
}

export function useSubmitRequest(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => requestService.submit(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(['requests', id], updated);
      void queryClient.invalidateQueries({ queryKey: ['requests', 'mine'] });
    },
  });
}

export function useCancelRequest(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => requestService.cancel(id, reason),
    onSuccess: (updated) => {
      queryClient.setQueryData(['requests', id], updated);
      void queryClient.invalidateQueries({ queryKey: ['requests', 'mine'] });
    },
  });
}

export function useSetRequestService(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serviceId: string) => requestService.setService(id, serviceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void queryClient.invalidateQueries({ queryKey: ['matching'] });
    },
  });
}
