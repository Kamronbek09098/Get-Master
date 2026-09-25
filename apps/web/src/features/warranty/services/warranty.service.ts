import { apiGet, apiPost } from '@/services/api.client';
import type { Warranty, WarrantyClaimInput } from '../types';

export const warrantyService = {
  listMine() {
    return apiGet<Warranty[]>('/warranties');
  },
  createClaim(warrantyId: string, input: WarrantyClaimInput) {
    return apiPost<unknown>(`/warranties/${warrantyId}/claims`, input);
  },
};
