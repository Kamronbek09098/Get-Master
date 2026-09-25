import { apiGet, apiPost } from '@/services/api.client';
import type { CursorPage } from '@/types/api';
import type { RequestStatus } from '@/types/common';
import type { CreateRequestInput, ProblemRequest, ProblemRequestSummary } from '../types';

export const requestService = {
  create(input: CreateRequestInput) {
    return apiPost<ProblemRequest>('/problem-requests', input);
  },
  listMine(params: { status?: RequestStatus; cursor?: string; limit?: number } = {}) {
    const search = new URLSearchParams();
    if (params.status) search.set('status', params.status);
    if (params.cursor) search.set('cursor', params.cursor);
    if (params.limit) search.set('limit', String(params.limit));
    const query = search.toString();
    return apiGet<CursorPage<ProblemRequestSummary>>(`/problem-requests${query ? `?${query}` : ''}`);
  },
  get(id: string) {
    return apiGet<ProblemRequest>(`/problem-requests/${id}`);
  },
  submit(id: string) {
    return apiPost<ProblemRequest>(`/problem-requests/${id}/submit`);
  },
  setService(id: string, serviceId: string) {
    return apiPost<unknown>(`/problem-requests/${id}/classification`, { serviceId });
  },
  cancel(id: string, reason: string) {
    return apiPost<ProblemRequest>(`/problem-requests/${id}/cancel`, { reason });
  },
};
