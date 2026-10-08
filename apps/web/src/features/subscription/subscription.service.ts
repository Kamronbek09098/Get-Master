import { apiGet, apiPatch, apiPost } from '@/services/api.client';
import type { AdminSubscriptionList, AdminSummary, MySubscriptions, PayMethod, PlanCode, PlansResponse, SubscriptionRow, SubscriptionStatus } from './types';

export const subscriptionService = {
  plans() {
    return apiGet<PlansResponse>('/subscriptions/plans');
  },
  me() {
    return apiGet<MySubscriptions>('/subscriptions/me');
  },
  request(input: { planCode: PlanCode; months: number; method: PayMethod }) {
    return apiPost<SubscriptionRow & { checkoutUrl: string | null }>('/subscriptions/requests', input);
  },
  cancel(id: string) {
    return apiPost<SubscriptionRow>(`/subscriptions/requests/${id}/cancel`);
  },
  adminList(status: SubscriptionStatus | '', page: number, q = '', method = '') {
    const search = new URLSearchParams();
    if (status) search.set('status', status);
    if (q.trim()) search.set('q', q.trim());
    if (method) search.set('method', method);
    search.set('page', String(page));
    return apiGet<AdminSubscriptionList>(`/admin/subscriptions?${search.toString()}`);
  },
  adminSummary() {
    return apiGet<AdminSummary>('/admin/subscriptions/summary');
  },
  attachReceipt(id: string, mediaAssetId: string) {
    return apiPost<SubscriptionRow>(`/subscriptions/requests/${id}/receipt`, { mediaAssetId });
  },
  approve(id: string) {
    return apiPatch<SubscriptionRow>(`/admin/subscriptions/${id}/approve`);
  },
  reject(id: string, reason: string) {
    return apiPatch<SubscriptionRow>(`/admin/subscriptions/${id}/reject`, { reason });
  },
  revoke(id: string, reason: string) {
    return apiPatch<SubscriptionRow>(`/admin/subscriptions/${id}/revoke`, { reason });
  },
  grant(input: { user: string; planCode: PlanCode; months: number; note?: string }) {
    return apiPost<SubscriptionRow>('/admin/subscriptions/grant', input);
  },
};
