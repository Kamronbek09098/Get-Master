import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { serviceService } from '../services/service.service';
import type { MasterServiceInput } from '../types';

export function useServiceCategories() {
  return useQuery({ queryKey: ['services', 'categories'], queryFn: () => serviceService.listCategories() });
}

export function useMyServices() {
  return useQuery({ queryKey: ['services', 'mine'], queryFn: () => serviceService.listMine() });
}

export function useAddMyService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MasterServiceInput) => serviceService.addMine(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services', 'mine'] }),
  });
}

export function useRemoveMyService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serviceId: string) => serviceService.removeMine(serviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services', 'mine'] }),
  });
}
