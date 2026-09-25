import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/utils';
import { usePaymentHistory } from '@/features/payment/hooks/usePayment';
import { PaymentStatus } from '@/features/payment/components/PaymentStatus';

export function PaymentHistoryPage() {
  const history = usePaymentHistory();

  if (history.isLoading) return <PageLoader label="To‘lovlar yuklanmoqda…" />;
  if (history.isError) return <Alert tone="danger">{getErrorMessage(history.error)}</Alert>;
  const items = history.data?.items ?? [];

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>To‘lovlar tarixi</h1>
          <p className="gm-page-lead">Barcha to‘lovlaringiz va ularning holati.</p>
        </div>
      </div>
      {items.length === 0 && <EmptyState title="To‘lovlar yo‘q" />}
      <div className="gm-list">
        {items.map((payment) => (
          <Link key={payment.id} to={`/mijozlar/buyurtmalar/${payment.orderId}`} className="gm-card">
            <PaymentStatus payment={payment} />
            <p className="gm-card__meta">
              {payment.provider} · {formatDateTime(payment.createdAt)}
              {payment.refundedAmount !== '0' && Number(payment.refundedAmount) > 0 && ` · Qaytarilgan: ${payment.refundedAmount}`}
            </p>
            {payment.failureReason && <p className="gm-card__meta">Sabab: {payment.failureReason}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
