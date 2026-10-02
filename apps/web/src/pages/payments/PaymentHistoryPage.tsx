import { providerLabel } from '@/features/payment/labels';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { CreditCard, ClipboardList, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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

  const empty = items.length === 0;

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>To‘lovlar tarixi</h1>
          <p className="gm-page-lead">Barcha to‘lovlaringiz va ularning holati.</p>
        </div>
      </div>
      {empty && (
        <EmptyState
          icon={<CreditCard size={34} strokeWidth={1.8} />}
          title="Hali to‘lovlar yo‘q"
          description="Ustani tanlab, buyurtma bergach, to‘lovlaringiz va ularning holati shu yerda ko‘rinadi."
          steps={[
            { icon: <ClipboardList size={16} aria-hidden="true" />, title: 'Buyurtma bering', text: 'So‘rov yarating va mos ustani tanlang.' },
            { icon: <CreditCard size={16} aria-hidden="true" />, title: 'To‘lovni amalga oshiring', text: 'Qulay usulni tanlab, buyurtma uchun to‘lang.' },
            { icon: <ReceiptText size={16} aria-hidden="true" />, title: 'Tarixni kuzating', text: 'Har bir to‘lov holati va qaytarishlar shu yerda.' },
          ]}
          action={
            <Link to="/mijozlar/sorov-yaratish">
              <Button>Yangi buyurtma yaratish</Button>
            </Link>
          }
        />
      )}
      <div className="gm-list">
        {items.map((payment) => (
          <Link key={payment.id} to={`/mijozlar/buyurtmalar/${payment.orderId}`} className="gm-card">
            <PaymentStatus payment={payment} />
            <p className="gm-card__meta">
              {providerLabel(payment.provider)} · {formatDateTime(payment.createdAt)}
              {payment.refundedAmount !== '0' && Number(payment.refundedAmount) > 0 && ` · Qaytarilgan: ${payment.refundedAmount}`}
            </p>
            {payment.failureReason && <p className="gm-card__meta">Sabab: {payment.failureReason}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
