import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionService } from '../services/session.service';

/** Ikki bosqichli autentifikatsiyani yoqish/o‘chirish (o‘chirish uchun joriy parol kerak). */
export function useSetTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { enabled: boolean; password?: string }) => sessionService.setTwoFactor(input),
    gcTime: 0,
    onSuccess: (me) => queryClient.setQueryData(['users', 'me'], me),
  });
}
