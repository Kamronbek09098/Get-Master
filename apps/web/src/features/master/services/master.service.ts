import { apiDelete, apiGet, apiPatch, apiPost } from '@/services/api.client';
import type { CursorPage } from '@/types/api';
import type { MasterInput, MasterProfile, PublicMaster } from '../types';
import type { Availability, AvailabilityInput, PortfolioInput, PortfolioItem } from '../manage.types';

export const masterService = {
  getMine() {
    return apiGet<MasterProfile>('/masters/me');
  },
  createMine(input: MasterInput) {
    return apiPost<MasterProfile>('/masters/me', input);
  },
  updateMine(input: Partial<MasterInput>) {
    return apiPatch<MasterProfile>('/masters/me', input);
  },
  list(params: { q?: string; categoryId?: string; cursor?: string } = {}) {
    const search = new URLSearchParams();
    if (params.q) search.set('q', params.q);
    if (params.categoryId) search.set('categoryId', params.categoryId);
    if (params.cursor) search.set('cursor', params.cursor);
    const query = search.toString();
    return apiGet<CursorPage<PublicMaster>>(`/masters${query ? `?${query}` : ''}`);
  },
  get(id: string) {
    return apiGet<PublicMaster>(`/masters/${id}`);
  },
  setStatus(status: 'ACTIVE' | 'INACTIVE') {
    return apiPatch<MasterProfile>('/masters/me/status', { status });
  },
  pause(reason: string, until?: string) {
    return apiPost<MasterProfile>('/masters/me/pause', { reason, until });
  },
  resume() {
    return apiPost<MasterProfile>('/masters/me/resume');
  },
  listAvailability() {
    return apiGet<Availability[] | CursorPage<Availability>>('/masters/me/availability');
  },
  createAvailability(input: AvailabilityInput) {
    return apiPost<Availability>('/masters/me/availability', input);
  },
  updateAvailability(id: string, input: Partial<AvailabilityInput>) {
    return apiPatch<Availability>(`/masters/me/availability/${id}`, input);
  },
  removeAvailability(id: string) {
    return apiDelete<unknown>(`/masters/me/availability/${id}`);
  },
  listPortfolio() {
    return apiGet<PortfolioItem[] | CursorPage<PortfolioItem>>('/masters/me/portfolio');
  },
  createPortfolio(input: PortfolioInput) {
    return apiPost<PortfolioItem>('/masters/me/portfolio', input);
  },
  removePortfolio(id: string) {
    return apiDelete<unknown>(`/masters/me/portfolio/${id}`);
  },
};
