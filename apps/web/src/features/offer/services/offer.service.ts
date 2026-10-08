import { apiGet, apiPost } from '@/services/api.client';
import type { CursorPage } from '@/types/api';
import type { AcceptOfferResult, CreateOfferInput, Offer, OpenRequest, OpenRequestScope } from '../types';

export const offerService = {
  listForRequest(requestId: string) {
    return apiGet<CursorPage<Offer>>(`/problem-requests/${requestId}/offers`);
  },
  listMine(cursor?: string) {
    return apiGet<CursorPage<Offer>>(`/offers/mine${cursor ? `?cursor=${cursor}` : ''}`);
  },
  listOpenRequests(scope: OpenRequestScope, cursor?: string) {
    const search = new URLSearchParams({ scope, limit: '20' });
    if (cursor) search.set('cursor', cursor);
    return apiGet<CursorPage<OpenRequest>>(`/masters/me/open-requests?${search.toString()}`);
  },
  create(input: CreateOfferInput) {
    return apiPost<Offer>('/offers', input);
  },
  withdraw(id: string) {
    return apiPost<Offer>(`/offers/${id}/withdraw`);
  },
  accept(id: string, idempotencyKey: string) {
    return apiPost<AcceptOfferResult>(`/offers/${id}/accept`, undefined, idempotencyKey);
  },
};
