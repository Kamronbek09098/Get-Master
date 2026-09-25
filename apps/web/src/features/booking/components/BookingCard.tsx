import { Link } from 'react-router-dom';
import { formatDateTime, formatMoney } from '@/lib/utils';
import { BookingStatus } from './BookingStatus';
import type { BookingWithOrder } from '../types';

export function BookingCard({ booking }: { booking: BookingWithOrder }) {
  return (
    <Link to={`/bronlar/${booking.id}`} className="gm-card">
      <div className="gm-card__header">
        <h3>{formatMoney(booking.agreedPrice, booking.currency)}</h3>
        <BookingStatus status={booking.order?.status ?? null} />
      </div>
      <p className="gm-card__meta">Boshlanish vaqti: {formatDateTime(booking.scheduledStartAt)}</p>
      <p className="gm-card__meta">Yaratildi: {formatDateTime(booking.createdAt)}</p>
    </Link>
  );
}
