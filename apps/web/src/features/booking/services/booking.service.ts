import { apiGet } from '@/services/api.client';
import type { Booking } from '@/features/offer/types';
import type { BookingWithOrder } from '../types';

export const bookingService = {
  listMine() {
    return apiGet<BookingWithOrder[]>('/bookings');
  },
  get(id: string) {
    return apiGet<Booking>(`/bookings/${id}`);
  },
};
