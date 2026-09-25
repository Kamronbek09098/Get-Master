import { apiDelete, apiGet, apiPatch, apiPost } from '@/services/api.client';
import type { Address, AddressInput, CustomerPreferences, CustomerProfile, UpdateProfileInput } from '../types';

export const customerService = {
  badges(offersSince?: string) {
    return apiGet<{ offers: number; now: string }>(`/customers/me/badges${offersSince ? `?offersSince=${encodeURIComponent(offersSince)}` : ''}`);
  },
  getProfile() {
    return apiGet<CustomerProfile>('/customers/me');
  },
  updateProfile(input: UpdateProfileInput) {
    return apiPatch<CustomerProfile>('/customers/me', input);
  },
  getPreferences() {
    return apiGet<CustomerPreferences>('/customers/me/preferences');
  },
  updatePreferences(input: Partial<CustomerPreferences>) {
    return apiPatch<CustomerPreferences>('/customers/me/preferences', input);
  },
  listAddresses() {
    return apiGet<Address[]>('/customers/me/addresses');
  },
  createAddress(input: AddressInput) {
    return apiPost<Address>('/customers/me/addresses', input);
  },
  deleteAddress(id: string) {
    return apiDelete<{ deleted: boolean }>(`/customers/me/addresses/${id}`);
  },
};
