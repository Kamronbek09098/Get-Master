import type { AttachmentType, OrderStatus, PaymentProvider, PaymentStatus, WorkStage } from '@/types/common';

export interface Order {
  id: string;
  orderNumber: number;
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
  /** Usta profili hozir ochiq (faol va tasdiqlangan) — faqat buyurtmalar ro‘yxatida keladi. */
  available?: boolean;
}

export interface OrderDetailsData extends Order {
  viewerRole: 'CUSTOMER' | 'MASTER';
  service: { id: string; name: string } | null;
  request: { id: string; title: string; description: string; serviceMode?: 'AT_CUSTOMER' | 'AT_MASTER' } | null;
  /** Uchrashuv joyi: `atMaster` — ustaning joyi (mijoz boradi). */
  location?: { atMaster?: boolean; latitude?: string | number | null; longitude?: string | number | null; addressLine?: string | null; title?: string | null; city?: string | null; district?: string | null } | null;
  scheduledStartAt: string | null;
  /** Ikkinchi tomon tasdiqlashini kutayotgan yangi vaqt taklifi (bo'lsa). */
  reschedule: { proposedStartAt: string; proposedByMe: boolean } | null;
  conversationId: string | null;
  counterpart: OrderParty;
  payment: { id: string; provider: PaymentProvider; status: PaymentStatus; amount: string; currency: string } | null;
  /** Mijoz qoldirgan sharh (bo‘lmasa null). */
  review: { rating: number; comment: string | null; createdAt: string } | null;
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
