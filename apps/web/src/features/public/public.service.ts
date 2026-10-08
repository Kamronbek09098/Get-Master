import { apiGet } from '@/services/api.client';
import type { PlansResponse } from '@/features/subscription/types';

export interface PublicMaster {
  id: number;
  name: string;
  profession: string | null;
  experienceYears: number | null;
  rating: number;
  reviews: number;
  completedOrders: number;
  works: number;
  isPro: boolean;
  services: string[];
}

export interface PublicMasterPage {
  total: number;
  page: number;
  hasMore: boolean;
  items: PublicMaster[];
}

export interface PublicStats {
  masters: number;
  completedOrders: number;
  categories: number;
  services: number;
  avgRating: number | null;
}

export const publicService = {
  masters(params: { categoryId?: string; q?: string; page: number }) {
    const search = new URLSearchParams({ page: String(params.page), limit: '12' });
    if (params.categoryId) search.set('categoryId', params.categoryId);
    if (params.q?.trim()) search.set('q', params.q.trim());
    return apiGet<PublicMasterPage>(`/public/masters?${search.toString()}`);
  },
  stats() {
    return apiGet<PublicStats>('/public/stats');
  },
  plans() {
    return apiGet<PlansResponse>('/public/plans');
  },
};
