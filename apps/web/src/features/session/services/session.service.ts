import { apiGet, apiPatch, apiPost } from '@/services/api.client';
import type { Me } from '../types';

export const sessionService = {
  updateName(input: { firstName: string; lastName: string }) {
    return apiPatch<Me>('/users/me/name', input);
  },
  setTwoFactor(input: { enabled: boolean; password?: string }) {
    return apiPatch<Me>('/users/me/two-factor', input);
  },
  setPassword(password: string) {
    return apiPost<Me>('/users/me/password', { password });
  },
  linkGoogle(credential: string) {
    return apiPost<{ linked: true; googleEmail: string | null }>('/auth/google/link', { credential });
  },
  unlinkGoogle() {
    return apiPost<{ linked: false }>('/auth/google/unlink');
  },
  me() {
    return apiGet<Me>('/users/me');
  },
};
