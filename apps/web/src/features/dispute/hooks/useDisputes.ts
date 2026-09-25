import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { disputeService } from '../services/dispute.service';
import type { CreateDisputeInput } from '../types';

export function useMyDisputes() {
  return useQuery({ queryKey: ['disputes', 'mine'], queryFn: () => disputeService.listMine() });
}

export function useCreateDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDisputeInput) => disputeService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['disputes', 'mine'] }),
  });
}
