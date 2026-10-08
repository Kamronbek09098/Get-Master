import type { ServiceMode } from '@/features/service/types';
import type { OrderStatus, RequestStatus } from '@/types/common';

export interface ProblemRequest {
  id: string;
  customerId: string;
  categoryId: string | null;
  serviceId: string | null;
  addressId: string | null;
  title: string;
  description: string;
  latitude: string | null;
  longitude: string | null;
  preferredStartAt: string | null;
  preferredEndAt: string | null;
  status: RequestStatus;
  cancellationReason: string | null;
  submittedAt: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
  serviceMode?: ServiceMode;
  createdAt: string;
  updatedAt: string;
  /** Tanlangan xizmat, toifa va manzil (faqat bitta so‘rovni olishda keladi). */
  service?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  address?: { title: string | null; addressLine: string; city: string | null; district: string | null } | null;
  _count?: { attachments: number };
  /** So‘rov bo‘yicha yaratilgan buyurtma (usta tanlangach). */
  order?: {
    id: string;
    status: OrderStatus;
    finalAmount: string;
    currency: string;
    master: { profession: string | null; user: { firstName: string | null; lastName: string | null; accountNumber: number } };
  } | null;
}

export interface ProblemRequestSummary extends ProblemRequest {
  service?: { id: string; name: string } | null;
  offersCount?: number;
}

export interface CreateRequestInput {
  serviceMode?: ServiceMode;
  title: string;
  description: string;
  serviceId?: string;
  addressId?: string;
  latitude?: number;
  longitude?: number;
  preferredStartAt?: string;
  preferredEndAt?: string;
}

export const CANCELLABLE_STATUSES: readonly RequestStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'MATCHING',
  'OFFERS_RECEIVED',
];
export const OFFER_ELIGIBLE_STATUSES: readonly RequestStatus[] = ['SUBMITTED', 'MATCHING', 'OFFERS_RECEIVED'];
