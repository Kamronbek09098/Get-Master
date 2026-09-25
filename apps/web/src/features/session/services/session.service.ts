import { apiGet, apiPatch } from '@/services/api.client';
import type { Me } from '../types';

export const sessionService = {
  updateName(input: { firstName: string; lastName: string }) {
    return apiPatch<Me>('/users/me/name', input);
  },
  me() {
    return apiGet<Me>('/users/me');
  },
};
