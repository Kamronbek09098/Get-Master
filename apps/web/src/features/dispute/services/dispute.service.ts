import { apiGet, apiPost } from '@/services/api.client';
import type { CursorPage } from '@/types/api';
import type { CaseItem, CreateDisputeInput } from '../types';

export const disputeService = {
  create(input: CreateDisputeInput) {
    return apiPost<CaseItem>('/disputes', input);
  },
  listMine() {
    return apiGet<CursorPage<CaseItem>>('/disputes');
  },
  get(id: string) {
    return apiGet<CaseItem>(`/disputes/${id}`);
  },
};
