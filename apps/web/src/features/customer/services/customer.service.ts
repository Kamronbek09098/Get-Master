import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/services/api.client';
import type { PublicMaster } from '@/features/master/types';
import type { Address, AddressInput, CustomerProfile, ProfileOverview, UpdateProfileInput } from '../types';

export const customerService = {
  badges(offersSince?: string) {
    return apiGet<{ offers: number; now: string }>(`/customers/me/badges${offersSince ? `?offersSince=${encodeURIComponent(offersSince)}` : ''}`);
  },
  overview(days: number) {
    return apiGet<ProfileOverview>(`/users/me/overview?days=${days}`);
  },
  getProfile() {
    return apiGet<CustomerProfile>('/customers/me');
  },
  updateProfile(input: UpdateProfileInput) {
    return apiPatch<CustomerProfile>('/customers/me', input);
  },
  listFavorites() {
    return apiGet<PublicMaster[]>('/customers/me/favorites');
  },
  addFavorite(masterId: string) {
    return apiPut<{ saved: boolean }>(`/customers/me/favorites/${masterId}`);
  },
  removeFavorite(masterId: string) {
    return apiDelete<{ saved: boolean }>(`/customers/me/favorites/${masterId}`);
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
