import { PageLoader } from '@/components/common/PageLoader';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { useMyBookings } from '@/features/booking/hooks/useBookings';
import { BookingCard } from '@/features/booking/components/BookingCard';

export function BookingsPage() {
  const bookings = useMyBookings();
  const items = bookings.data ?? [];

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>Bronlarim</h1>
          <p className="gm-page-lead">Qabul qilingan takliflar bo‘yicha band qilingan vaqtlar.</p>
        </div>
      </div>
      {bookings.isLoading && <PageLoader label="Bronlar yuklanmoqda…" />}
      {bookings.isError && <Alert tone="danger">{getErrorMessage(bookings.error)}</Alert>}
      {!bookings.isLoading && !bookings.isError && items.length === 0 && (
        <EmptyState title="Hali bron yo‘q" description="Taklifni qabul qilganingizdan keyin bron shu yerda ko‘rinadi." />
      )}
      <div className="gm-list">
        {items.map((booking) => (
          <BookingCard key={booking.id} booking={booking} />
        ))}
      </div>
    </div>
  );
}
