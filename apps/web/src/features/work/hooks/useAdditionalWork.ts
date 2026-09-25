import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workService } from '../services/work.service';
import type { CreateAdditionalWorkInput } from '../types';

export function useAdditionalWork(orderId: string) {
  return useQuery({ queryKey: ['additional-work', orderId], queryFn: () => workService.list(orderId) });
}

export function useCreateAdditionalWork(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAdditionalWorkInput) => workService.create(orderId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['additional-work', orderId] }),
  });
}

export function useAnswerAdditionalWork(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      approve ? workService.approve(id) : workService.reject(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['additional-work', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
