import type { OfferStatus } from '@/types/common';
import type { Order } from '@/features/order/types';

export interface Offer {
  id: string;
  requestId: string;
  masterId: string;
  price: string;
  currency: string;
  estimatedMinutes: number | null;
  message: string | null;
  availableAt: string | null;
  status: OfferStatus;
  expiresAt: string;
  createdAt: string;
  master?: {
    id: string;
    ratingAvg: string;
    ratingCount: number;
    user: { accountNumber?: number; firstName: string | null; lastName: string | null };
  };
}

export interface IncomingRequest {
  id: string;
  score: string | null;
  createdAt: string;
  request: {
    id: string;
    title: string;
    description: string;
    status: string;
    preferredStartAt: string | null;
    preferredEndAt: string | null;
    expiresAt: string | null;
    createdAt: string;
    offers: Array<{ id: string; status: OfferStatus }>;
  };
}

export interface OpenRequest {
  id: string;
  title: string;
  description: string;
  status: string;
  preferredStartAt: string | null;
  preferredEndAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  service: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  offersCount: number;
  myOffer: { id: string; status: OfferStatus; price: string } | null;
  notified: boolean;
  /** «Plus» mijozning tezkor so‘rovi. */
  isPriority?: boolean;
  suggested: { price: string | null; estimatedMinutes: number | null } | null;
  /** Mijoz ismi (familiyasining bosh harfi bilan), tuman/shahar va taxminiy masofa. */
  customerName?: string | null;
  area?: string | null;
  distanceKm?: number | null;
  /** Mijoz biriktirgan rasmlar (ko‘pi bilan 4 tasi) va umumiy soni. */
  photos?: string[];
  photosCount?: number;
}

export type OpenRequestScope = 'mine' | 'all';

export interface CreateOfferInput {
  requestId: string;
  price: number;
  estimatedMinutes?: number;
  message?: string;
}

export interface Booking {
  id: string;
  requestId: string;
  offerId: string;
  customerId: string;
  masterId: string;
  serviceId: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  agreedPrice: string;
  currency: string;
  locationSnapshot: unknown;
  serviceSnapshot: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptOfferResult {
  booking: Booking;
  order: Order;
}
