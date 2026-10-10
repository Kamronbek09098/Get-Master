import { apiDelete, apiGet, apiPost } from '@/services/api.client';
import type { CreateWorkProofInput, Order, OrderDetailsData, OrderListItem, OrderTimelineEntry, WorkProof } from '../types';

export const orderService = {
  listMine() {
    return apiGet<OrderListItem[]>('/orders');
  },
  get(id: string) {
    return apiGet<OrderDetailsData>(`/orders/${id}`);
  },
  timeline(id: string) {
    return apiGet<OrderTimelineEntry[]>(`/orders/${id}/timeline`);
  },
  workProofs(id: string) {
    return apiGet<WorkProof[]>(`/orders/${id}/work-proofs`);
  },
  removeWorkProof(id: string, proofId: string) {
    return apiDelete<{ deleted: boolean }>(`/orders/${id}/work-proofs/${proofId}`);
  },
  confirm(id: string) {
    return apiPost<Order>(`/orders/${id}/confirm`);
  },
  startTravel(id: string) {
    return apiPost<Order>(`/orders/${id}/start-travel`);
  },
  reportEta(id: string, input: { remainingS: number; remainingM: number }) {
    return apiPost<{ remainingS: number; remainingM: number; updatedAt: string }>(`/orders/${id}/eta`, input);
  },
  getEta(id: string) {
    return apiGet<{ eta: { remainingS: number; remainingM: number; updatedAt: string; arriveAt: string } | null }>(`/orders/${id}/eta`);
  },
  arrive(id: string, position?: { latitude: number; longitude: number; accuracy?: number; fixedAt?: number }) {
    return apiPost<Order>(`/orders/${id}/arrive`, position);
  },
  addWorkProof(id: string, input: CreateWorkProofInput) {
    return apiPost<WorkProof>(`/orders/${id}/work-proofs`, input);
  },
  startWork(id: string) {
    return apiPost<Order>(`/orders/${id}/start-work`);
  },
  submitCompletion(id: string) {
    return apiPost<Order>(`/orders/${id}/submit-completion`);
  },
  createDirect(input: { conversationId: string; title: string; description: string; price: number; scheduledStartAt: string; addressId?: string }) {
    return apiPost<{ order: Order; messageId: string }>('/orders/direct', input);
  },
  /** Ishni tasdiqlaydi. Server to‘lov to‘liq amalga oshganini tekshiradi (aks holda 409 PAYMENT_REQUIRED). */
  confirmCompletion(id: string) {
    return apiPost<Order>(`/orders/${id}/confirm-completion`, {});
  },
  dispute(id: string, reason: string) {
    return apiPost<Order>(`/orders/${id}/dispute`, { reason });
  },
  cancel(id: string, reason: string) {
    return apiPost<Order>(`/orders/${id}/cancel`, { reason });
  },
  proposeReschedule(id: string, scheduledStartAt: string) {
    return apiPost<{ proposed: true; proposedStartAt: string }>(`/orders/${id}/reschedule`, { scheduledStartAt });
  },
  acceptReschedule(id: string) {
    return apiPost<{ scheduledStartAt: string }>(`/orders/${id}/reschedule/accept`);
  },
  declineReschedule(id: string) {
    return apiPost<{ declined: true }>(`/orders/${id}/reschedule/decline`);
  },
};
