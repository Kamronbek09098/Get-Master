import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customerService } from '../services/customer.service';
import type { AddressInput, UpdateProfileInput } from '../types';

export function useCustomerProfile() {
  return useQuery({ queryKey: ['customer', 'profile'], queryFn: () => customerService.getProfile() });
}

export function useProfileOverview(days: number) {
  return useQuery({ queryKey: ['customer', 'overview', days], queryFn: () => customerService.overview(days), staleTime: 30_000, placeholderData: keepPreviousData });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => customerService.updateProfile(input),
    onSuccess: (profile) => queryClient.setQueryData(['customer', 'profile'], profile),
  });
}

export function useAddresses() {
  return useQuery({ queryKey: ['customer', 'addresses'], queryFn: () => customerService.listAddresses() });
}

export function useCreateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddressInput) => customerService.createAddress(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer', 'addresses'] }),
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customerService.deleteAddress(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer', 'addresses'] }),
  });
}
