import { apiGet, apiPost } from '@/services/api.client';
import type { AdditionalWork, CreateAdditionalWorkInput } from '../types';

export const workService = {
  list(orderId: string) {
    return apiGet<AdditionalWork[]>(`/orders/${orderId}/additional-work`);
  },
  create(orderId: string, input: CreateAdditionalWorkInput) {
    return apiPost<AdditionalWork>(`/orders/${orderId}/additional-work`, input);
  },
  approve(id: string) {
    return apiPost<AdditionalWork>(`/additional-work/${id}/approve`);
  },
  reject(id: string) {
    return apiPost<AdditionalWork>(`/additional-work/${id}/reject`);
  },
};
