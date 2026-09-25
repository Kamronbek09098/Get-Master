import { apiGet, apiPost } from '@/services/api.client';
import type { CursorPage } from '@/types/api';
import type { CreateReviewInput, Review } from '../types';

export const reviewService = {
  create(input: CreateReviewInput) {
    return apiPost<Review>('/reviews', input);
  },
  listByMaster(masterId: string) {
    return apiGet<CursorPage<Review>>(`/reviews?masterId=${masterId}`);
  },
};
