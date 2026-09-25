import { Link, useParams } from 'react-router-dom';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime, formatMoney } from '@/lib/utils';
import { useBooking } from '@/features/booking/hooks/useBookings';

export function BookingDetailsPage() {
  const { id = '' } = useParams();
  const booking = useBooking(id);

  if (booking.isLoading) return <PageLoader label="Bron yuklanmoqda…" />;
  if (booking.isError) return <Alert tone="danger">{getErrorMessage(booking.error)}</Alert>;
  if (!booking.data) return null;

  const data = booking.data;
  return (
    <div>
      <div className="gm-page-header">
        <h1>Bron tafsilotlari</h1>
        <Link to="/bronlar">
          <Button size="sm" variant="secondary">
            Orqaga
          </Button>
        </Link>
      </div>
      <dl className="gm-key-value">
        <dt>Kelishilgan narx</dt>
        <dd>{formatMoney(data.agreedPrice, data.currency)}</dd>
        <dt>Boshlanish</dt>
        <dd>{formatDateTime(data.scheduledStartAt)}</dd>
        <dt>Tugash</dt>
        <dd>{formatDateTime(data.scheduledEndAt)}</dd>
        <dt>Yaratildi</dt>
        <dd>{formatDateTime(data.createdAt)}</dd>
      </dl>
    </div>
  );
}
