import { providerLabel } from '@/features/payment/labels';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { ChevronRight, CreditCard, ClipboardList, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime, formatMoney } from '@/lib/utils';
import { usePaymentHistory } from '@/features/payment/hooks/usePayment';
import { ProviderLogo } from '@/features/payment/components/ProviderLogo';
import { PaymentBadge } from '@/features/payment/components/PaymentStatus';
import type { PaymentStatus as PaymentStatusEnum } from '@/types/common';
import './PaymentHistoryPage.css';
import { t } from '@/i18n';

const STATUS_TONE: Record<PaymentStatusEnum, 'ok' | 'bad' | 'wait'> = {
  PENDING: 'wait',
  PROCESSING: 'wait',
  SUCCEEDED: 'ok',
  FAILED: 'bad',
  CANCELLED: 'bad',
  REFUNDED: 'wait',
  PARTIALLY_REFUNDED: 'wait',
};

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
            <Link to="/mijoz/sorov-yaratish">
              <Button>{t('Yangi buyurtma yaratish')}</Button>
            </Link>
          }
        />
      )}
      <ul className="gm-phist">
        {items.map((payment) => {
          const refunded = Number(payment.refundedAmount) > 0;
          return (
            <li key={payment.id}>
              <Link to={`/mijoz/buyurtmalar/${payment.orderId}`} className={`gm-phist__card gm-phist__card--${STATUS_TONE[payment.status]}`}>
                <span className="gm-phist__icon" aria-hidden="true">
                  <ProviderLogo provider={payment.provider} size={44} />
                </span>
                <div className="gm-phist__main">
                  <strong>{providerLabel(payment.provider)}</strong>
                  <time dateTime={payment.createdAt}>{formatDateTime(payment.createdAt)}</time>
                  {refunded && <small className="gm-phist__note">{t(' · Qaytarilgan: {refundedAmount}', { refundedAmount: formatMoney(payment.refundedAmount, payment.currency) }).replace(/^ · /, '')}</small>}
                  {payment.failureReason && <small className="gm-phist__note gm-phist__note--bad">{t('Sabab:')}{' '}{payment.failureReason}</small>}
                </div>
                <div className="gm-phist__side">
                  <strong className="gm-phist__amount">{formatMoney(payment.amount, payment.currency)}</strong>
                  <PaymentBadge status={payment.status} />
                </div>
                <ChevronRight size={18} className="gm-phist__chevron" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
