import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trustService } from '../services/trust.service';
import type { SubmitVerificationInput } from '../types';

export function useTrustStatus() {
  return useQuery({ queryKey: ['trust', 'status'], queryFn: () => trustService.getStatus(), retry: false });
}

export function useRemoveVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trustService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trust', 'status'] });
      void queryClient.invalidateQueries({ queryKey: ['master', 'me'] });
    },
  });
}

export function useSubmitVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitVerificationInput) => trustService.submit(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trust', 'status'] }),
  });
}
