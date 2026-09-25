import { useQuery } from '@tanstack/react-query';
import { bookingService } from '../services/booking.service';

export function useMyBookings() {
  return useQuery({ queryKey: ['bookings', 'mine'], queryFn: () => bookingService.listMine() });
}

export function useBooking(id: string) {
  return useQuery({ queryKey: ['bookings', id], queryFn: () => bookingService.get(id), enabled: !!id });
}
