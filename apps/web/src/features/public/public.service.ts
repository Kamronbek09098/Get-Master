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

export interface CatalogService {
  id: string;
  name: string;
  description: string | null;
  category: { id: string; name: string };
  masters: number;
  minPrice: number | null;
  maxPrice: number | null;
  rating: number | null;
  ratingCount: number;
}

export interface CatalogPage {
  items: CatalogService[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  facets: {
    categories: Array<{ id: string; name: string; count: number }>;
    price: { min: number; max: number };
    masters: { one: number; few: number; many: number };
    ratings: { r45: number; r40: number; r35: number };
    available: number;
  };
}

export interface CatalogFilters {
  q?: string;
  categories?: string[];
  region?: string;
  minPrice?: number;
  maxPrice?: number;
  masters?: '1' | '2-3' | '4+';
  minRating?: number;
  available?: boolean;
  sort?: 'popular' | 'price_asc' | 'price_desc' | 'rating' | 'name';
}

export const publicService = {
  services(filters: CatalogFilters, page: number, limit: number) {
    const search = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters.q?.trim()) search.set('q', filters.q.trim());
    if (filters.categories?.length) search.set('categories', filters.categories.join(','));
    if (filters.region) search.set('region', filters.region);
    if (filters.minPrice !== undefined) search.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice !== undefined) search.set('maxPrice', String(filters.maxPrice));
    if (filters.masters) search.set('masters', filters.masters);
    if (filters.minRating !== undefined) search.set('minRating', String(filters.minRating));
    if (filters.available) search.set('available', 'true');
    if (filters.sort) search.set('sort', filters.sort);
    return apiGet<CatalogPage>(`/public/services?${search.toString()}`);
  },
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
