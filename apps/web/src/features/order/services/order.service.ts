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
  arrive(id: string) {
    return apiPost<Order>(`/orders/${id}/arrive`);
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
  confirmCompletion(id: string, paymentMethod?: string) {
    return apiPost<Order>(`/orders/${id}/confirm-completion`, paymentMethod ? { paymentMethod } : {});
  },
  dispute(id: string, reason: string) {
    return apiPost<Order>(`/orders/${id}/dispute`, { reason });
  },
  cancel(id: string, reason: string) {
    return apiPost<Order>(`/orders/${id}/cancel`, { reason });
  },
};
