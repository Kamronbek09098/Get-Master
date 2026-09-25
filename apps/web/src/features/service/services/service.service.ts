import { apiDelete, apiGet, apiPost } from '@/services/api.client';
import type { MasterServiceInput, MasterServiceItem, ServiceCategory } from '../types';

export const serviceService = {
  listCategories() {
    return apiGet<ServiceCategory[]>('/service-categories');
  },
  listMine() {
    return apiGet<MasterServiceItem[]>('/masters/me/services');
  },
  addMine(input: MasterServiceInput) {
    return apiPost<MasterServiceItem>('/masters/me/services', input);
  },
  removeMine(serviceId: string) {
    return apiDelete<unknown>(`/masters/me/services/${serviceId}`);
  },
};
