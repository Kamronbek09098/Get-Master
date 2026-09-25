import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toItems } from '@/lib/list';
import { safetyService } from '../services/safety.service';
import type { AppealStatus, CreateCompensationInput, CreateUserActionInput } from '../types';

export function useMyActions() {
  return useQuery({ queryKey: ['safety', 'my-actions'], queryFn: async () => toItems(await safetyService.myActions()) });
}

export function useMyAppeals() {
  return useQuery({ queryKey: ['safety', 'my-appeals'], queryFn: async () => toItems(await safetyService.myAppeals()) });
}

export function useMyCompensations() {
  return useQuery({
    queryKey: ['safety', 'my-compensations'],
    queryFn: async () => toItems(await safetyService.myCompensations()),
  });
}

export function useCreateAppeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: string; actionId?: string; caseId?: string }) => safetyService.createAppeal(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['safety'] }),
  });
}

export function useAllActions() {
  return useQuery({ queryKey: ['safety', 'actions'], queryFn: async () => toItems(await safetyService.allActions()) });
}

export function useCreateAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserActionInput) => safetyService.createAction(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['safety'] }),
  });
}

export function useLiftAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => safetyService.liftAction(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['safety'] }),
  });
}

export function useAllAppeals() {
  return useQuery({ queryKey: ['safety', 'appeals'], queryFn: async () => toItems(await safetyService.allAppeals()) });
}

export function useResolveAppeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, decision }: { id: string; status: AppealStatus; decision?: string }) =>
      safetyService.resolveAppeal(id, status, decision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['safety'] }),
  });
}

export function useCreateCompensation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCompensationInput) => safetyService.createCompensation(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['safety'] }),
  });
}
