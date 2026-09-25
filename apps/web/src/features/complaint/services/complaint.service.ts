import { apiGet, apiPost } from '@/services/api.client';
import type { CursorPage } from '@/types/api';
import type { Complaint, CreateComplaintInput } from '../types';

export const complaintService = {
  create(input: CreateComplaintInput) {
    return apiPost<Complaint>('/complaints', input);
  },
  listMine() {
    return apiGet<CursorPage<Complaint>>('/complaints');
  },
};
