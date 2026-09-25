import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toItems } from '@/lib/list';
import { masterService } from '../services/master.service';
import type { AvailabilityInput, PortfolioInput } from '../manage.types';

export function useAvailability() {
  return useQuery({
    queryKey: ['master', 'availability'],
    queryFn: async () => toItems(await masterService.listAvailability()),
  });
}

export function useSaveAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AvailabilityInput) => masterService.createAvailability(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master', 'availability'] }),
  });
}

export function useToggleAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      masterService.updateAvailability(id, { isAvailable }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master', 'availability'] }),
  });
}

export function useRemoveAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterService.removeAvailability(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master', 'availability'] }),
  });
}

export function usePortfolio() {
  return useQuery({
    queryKey: ['master', 'portfolio'],
    queryFn: async () => toItems(await masterService.listPortfolio()),
  });
}

export function useAddPortfolio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PortfolioInput) => masterService.createPortfolio(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master', 'portfolio'] }),
  });
}

export function useRemovePortfolio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => masterService.removePortfolio(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master', 'portfolio'] }),
  });
}

export function useMasterAvailabilityStatus() {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: ['master', 'me'] });
  return {
    setStatus: useMutation({ mutationFn: (s: 'ACTIVE' | 'INACTIVE') => masterService.setStatus(s), onSuccess }),
    pause: useMutation({
      mutationFn: (v: { reason: string; until?: string }) => masterService.pause(v.reason, v.until),
      onSuccess,
    }),
    resume: useMutation({ mutationFn: () => masterService.resume(), onSuccess }),
  };
}
