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
  services: Array<{ name: string; price: number | null }>;
  serviceModes?: Array<'AT_CUSTOMER' | 'AT_MASTER'>;
  placeAddress?: string | null;
  region?: string | null;
  regionName?: string | null;
}

export interface PublicRegion {
  key: string;
  name: string;
  masters: number;
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

export interface PriceCategory {
  id: string;
  name: string;
  masters: number;
  services: Array<{ id: string; name: string; minPrice: number | null; masters: number }>;
}

export const publicService = {
  masters(params: { categoryId?: string; q?: string; mode?: string; region?: string; page: number }) {
    const search = new URLSearchParams({ page: String(params.page), limit: '12' });
    if (params.categoryId) search.set('categoryId', params.categoryId);
    if (params.mode) search.set('mode', params.mode);
    if (params.region) search.set('region', params.region);
    if (params.q?.trim()) search.set('q', params.q.trim());
    return apiGet<PublicMasterPage>(`/public/masters?${search.toString()}`);
  },
  stats() {
    return apiGet<PublicStats>('/public/stats');
  },
  regions() {
    return apiGet<PublicRegion[]>('/public/regions');
  },
  prices() {
    return apiGet<PriceCategory[]>('/public/prices');
  },
  plans() {
    return apiGet<PlansResponse>('/public/plans');
  },
};
