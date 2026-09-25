import type { OrderStatus } from '@/types/common';
import type { Booking } from '@/features/offer/types';

export interface BookingWithOrder extends Booking {
  order: { id: string; status: OrderStatus } | null;
}
