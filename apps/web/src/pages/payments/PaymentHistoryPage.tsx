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
import { t } from '@/i18n';

export function PaymentHistoryPage() {
  const history = usePaymentHistory();

  if (history.isLoading) return <PageLoader label={t('To‘lovlar yuklanmoqda…')} />;
  if (history.isError) return <Alert tone="danger">{getErrorMessage(history.error)}</Alert>;
  const items = history.data?.items ?? [];

  const empty = items.length === 0;

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>{t('To‘lovlar tarixi')}</h1>
          <p className="gm-page-lead">{t('Barcha to‘lovlaringiz va ularning holati.')}</p>
        </div>
      </div>
      {empty && (
        <EmptyState
          icon={<CreditCard size={34} strokeWidth={1.8} />}
          title={t('Hali to‘lovlar yo‘q')}
          description={t('Ustani tanlab, buyurtma bergach, to‘lovlaringiz va ularning holati shu yerda ko‘rinadi.')}
          steps={[
            { icon: <ClipboardList size={16} aria-hidden="true" />, title: t('Buyurtma bering'), text: t('So‘rov yarating va mos ustani tanlang.') },
            { icon: <CreditCard size={16} aria-hidden="true" />, title: t('To‘lovni amalga oshiring'), text: t('Qulay usulni tanlab, buyurtma uchun to‘lang.') },
            { icon: <ReceiptText size={16} aria-hidden="true" />, title: t('Tarixni kuzating'), text: t('Har bir to‘lov holati va qaytarishlar shu yerda.') },
          ]}
          action={
            <Link to="/mijozlar/sorov-yaratish">
              <Button>{t('Yangi buyurtma yaratish')}</Button>
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
              {payment.refundedAmount !== '0' && Number(payment.refundedAmount) > 0 && t(' · Qaytarilgan: {refundedAmount}', { refundedAmount: payment.refundedAmount })}
            </p>
            {payment.failureReason && <p className="gm-card__meta">{t('Sabab:')}{' '}{payment.failureReason}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
