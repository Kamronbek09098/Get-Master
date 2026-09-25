import type { AttachmentType, OrderStatus, WorkStage } from '@/types/common';

export interface Order {
  id: string;
  bookingId: string;
  customerId: string;
  masterId: string;
  status: OrderStatus;
  originalAmount: string;
  additionalAmount: string;
  finalAmount: string;
  currency: string;
  platformFee: string | null;
  masterAmount: string | null;
  startedAt: string | null;
  completionSubmittedAt: string | null;
  completedAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderParty {
  id: string;
  accountNumber?: number;
  firstName: string | null;
  lastName: string | null;
  profession?: string | null;
}

export interface OrderDetailsData extends Order {
  viewerRole: 'CUSTOMER' | 'MASTER';
  service: { id: string; name: string } | null;
  request: { id: string; title: string; description: string } | null;
  scheduledStartAt: string | null;
  conversationId: string | null;
  counterpart: OrderParty;
}

export interface OrderListItem extends Order {
  viewerRole: 'CUSTOMER' | 'MASTER' | null;
  service: { id: string; name: string } | null;
  title: string;
  scheduledStartAt: string | null;
  counterpart: OrderParty;
}

export interface OrderTimelineEntry {
  id: string;
  oldStatus: OrderStatus | null;
  newStatus: OrderStatus;
  actorType: 'CUSTOMER' | 'MASTER' | 'ADMIN' | 'SYSTEM';
  reason: string | null;
  createdAt: string;
}

export interface WorkProof {
  id: string;
  orderId: string;
  uploadedById: string;
  stage: WorkStage;
  storageKey: string;
  mediaType: AttachmentType;
  mediaAssetId: string | null;
  createdAt: string;
}

export interface CreateWorkProofInput {
  stage: WorkStage;
  mediaAssetId: string;
}

export const CUSTOMER_CANCELLABLE_STATUSES: readonly OrderStatus[] = ['BOOKED', 'CONFIRMED'];
export const DISPUTABLE_STATUSES: readonly OrderStatus[] = ['IN_PROGRESS', 'WAITING_CONFIRMATION'];
