import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime, formatMoney } from '@/lib/utils';
import { useEarnings } from '@/features/payment/hooks/usePayment';
import { PaymentStatus } from '@/features/payment/components/PaymentStatus';

export function EarningsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const earnings = useEarnings({
    dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
    dateTo: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
  });

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>Daromad</h1>
          <p className="gm-page-lead">Tushum, to‘lovlar va sof daromadingiz.</p>
        </div>
      </div>
      <div className="gm-toolbar">
        <Input label="Boshlanish sanasi" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input label="Tugash sanasi" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>
      {earnings.isLoading && <PageLoader label="Daromad yuklanmoqda…" />}
      {earnings.isError && <Alert tone="danger">{getErrorMessage(earnings.error)}</Alert>}
      {earnings.data && (
        <>
          <div className="gm-stat-grid">
            <div className="gm-stat">
              <span className="gm-stat__value">{formatMoney(earnings.data.summary.netAmount)}</span>
              <span className="gm-stat__label">Sof daromad</span>
            </div>
            <div className="gm-stat">
              <span className="gm-stat__value">{formatMoney(earnings.data.summary.grossAmount)}</span>
              <span className="gm-stat__label">Jami tushum</span>
            </div>
            <div className="gm-stat">
              <span className="gm-stat__value">{formatMoney(earnings.data.summary.refundedAmount)}</span>
              <span className="gm-stat__label">Qaytarilgan</span>
            </div>
            <div className="gm-stat">
              <span className="gm-stat__value">{earnings.data.summary.paymentCount}</span>
              <span className="gm-stat__label">To‘lovlar soni</span>
            </div>
          </div>
          <section className="gm-detail-section">
            <h2>To‘lovlar</h2>
            {earnings.data.items.length === 0 && <EmptyState title="Bu davrda to‘lovlar yo‘q" />}
            <div className="gm-list">
              {earnings.data.items.map((payment) => (
                <div key={payment.id} className="gm-card">
                  <PaymentStatus payment={payment} />
                  <p className="gm-card__meta">{formatDateTime(payment.succeededAt ?? payment.createdAt)}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
