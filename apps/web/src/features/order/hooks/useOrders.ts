import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orderService } from '../services/order.service';
import type { CreateWorkProofInput } from '../types';

export function useMyOrders() {
  return useQuery({ queryKey: ['orders', 'mine'], queryFn: () => orderService.listMine() });
}

export function useOrder(id: string, refetchInterval = 30_000) {
  return useQuery({ queryKey: ['orders', id], queryFn: () => orderService.get(id), enabled: !!id, refetchInterval });
}

export function useOrderTimeline(id: string) {
  return useQuery({ queryKey: ['orders', id, 'timeline'], queryFn: () => orderService.timeline(id), enabled: !!id });
}

export function useWorkProofs(id: string) {
  return useQuery({ queryKey: ['orders', id, 'workProofs'], queryFn: () => orderService.workProofs(id), enabled: !!id });
}

function useRefreshOrder(id: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['orders', id] });
    void queryClient.invalidateQueries({ queryKey: ['orders', 'mine'] });
  };
}

function useOrderMutation(id: string, mutationFn: (id: string) => Promise<unknown>) {
  const refresh = useRefreshOrder(id);
  return useMutation({ mutationFn: () => mutationFn(id), onSuccess: refresh });
}

export const useConfirmOrder = (id: string) => useOrderMutation(id, orderService.confirm);
export const useStartTravel = (id: string) => useOrderMutation(id, orderService.startTravel);
export const useArrive = (id: string) => useOrderMutation(id, orderService.arrive);
export const useStartWork = (id: string) => useOrderMutation(id, orderService.startWork);
export const useSubmitCompletion = (id: string) => useOrderMutation(id, orderService.submitCompletion);
export function useConfirmCompletion(id: string) {
  const refresh = useRefreshOrder(id);
  return useMutation({ mutationFn: (paymentMethod?: string) => orderService.confirmCompletion(id, paymentMethod), onSuccess: refresh });
}

export function useCancelOrder(id: string) {
  const refresh = useRefreshOrder(id);
  return useMutation({ mutationFn: (reason: string) => orderService.cancel(id, reason), onSuccess: refresh });
}

export function useDisputeOrder(id: string) {
  const refresh = useRefreshOrder(id);
  return useMutation({ mutationFn: (reason: string) => orderService.dispute(id, reason), onSuccess: refresh });
}

export function useAddWorkProof(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkProofInput) => orderService.addWorkProof(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', id, 'workProofs'] }),
  });
}

export function useRemoveWorkProof(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proofId: string) => orderService.removeWorkProof(id, proofId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', id, 'workProofs'] }),
  });
}

export function useCreateDirectOrder(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; description: string; price: number; scheduledStartAt?: string; addressId?: string }) => orderService.createDirect({ conversationId, ...input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
