import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customerService } from '../services/customer.service';
import type { AddressInput, CustomerPreferences, UpdateProfileInput } from '../types';

export function useCustomerProfile() {
  return useQuery({ queryKey: ['customer', 'profile'], queryFn: () => customerService.getProfile() });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => customerService.updateProfile(input),
    onSuccess: (profile) => queryClient.setQueryData(['customer', 'profile'], profile),
  });
}

export function useCustomerPreferences() {
  return useQuery({ queryKey: ['customer', 'preferences'], queryFn: () => customerService.getPreferences() });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CustomerPreferences>) => customerService.updatePreferences(input),
    onSuccess: (preferences) => queryClient.setQueryData(['customer', 'preferences'], preferences),
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
