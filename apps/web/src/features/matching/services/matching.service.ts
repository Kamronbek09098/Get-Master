import { apiGet } from '@/services/api.client';
import type { MatchingResponse } from '../types';

export const matchingService = {
  getForRequest(requestId: string) {
    return apiGet<MatchingResponse>(`/problem-requests/${requestId}/matching`);
  },
};
