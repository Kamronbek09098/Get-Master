import { useNavigate } from 'react-router-dom';
import { providerLabel } from '@/features/payment/labels';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime, formatMoney, newIdempotencyKey } from '@/lib/utils';
import { useRefund, useRevenueReport } from '@/features/admin/hooks/useAdmin';
import { StatGrid } from '@/features/admin/components/StatGrid';
import { DateRangeFilter } from '@/features/admin/components/DateRangeFilter';
import { toRange } from '@/features/admin/range';
import type { RefundReason } from '@/types/common';
import './AdminReportsPage.css';
import { t } from '@/i18n';

const REASONS: Array<{ value: RefundReason; label: string }> = [
  { value: 'CUSTOMER_REQUEST', label: t('Mijoz talabi') },
  { value: 'DISPUTE', label: t('Nizo') },
  { value: 'CANCELLATION', label: t('Bekor qilish') },
  { value: 'WARRANTY', label: t('Kafolat') },
  { value: 'ADMIN_DECISION', label: t('Admin qarori') },
  { value: 'PAYMENT_ERROR', label: t('To‘lov xatosi') },
  { value: 'OTHER', label: t('Boshqa') },
];

export function AdminReportsPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState({ from: '', to: '' });
  const report = useRevenueReport(toRange(range));
  const refund = useRefund();
  const [target, setTarget] = useState<{ id: string; max: number } | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<RefundReason>('ADMIN_DECISION');
  const [note, setNote] = useState('');

  const summary = report.data?.summary;

  function submitRefund() {
    if (!target) return;
    refund.mutate(
      { id: target.id, amount: Number(amount), reason, note: note.trim(), idempotencyKey: newIdempotencyKey() },
      {
        onSuccess: () => {
          setTarget(null);
          setAmount('');
          setNote('');
        },
      },
    );
  }

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>{t('Hisobotlar')}</h1>
          <p className="gm-page-lead">{t('Daromad va faoliyat hisobotlari.')}</p>
        </div>
      </div>
      <DateRangeFilter value={range} onChange={setRange} />
      {report.isLoading && <PageLoader label={t('Hisobot yuklanmoqda…')} />}
      {report.isError && <Alert tone="danger">{getErrorMessage(report.error)}</Alert>}
      {summary && (
        <>
          <StatGrid
            items={[
              { label: t('Jami tushum'), value: formatMoney(summary.totalRevenue) },
              { label: t('Qaytarilgan'), value: formatMoney(summary.totalRefunded) },
              { label: t('Sof tushum'), value: formatMoney(summary.netRevenue) },
              {
                label: t('Ilova sof foydasi ({toFixed}%)', { toFixed: (summary.commissionRate * 100).toFixed(0) }),
                value: formatMoney(summary.platformProfit),
              },
              { label: t('To‘lovlar'), value: summary.totalPayments },
              { label: t('Buyurtmalar'), value: summary.totalOrders },
              { label: t('Yakunlangan'), value: summary.completedOrders },
              { label: t('Bekor qilingan'), value: summary.cancelledOrders },
              { label: t('Nizolar'), value: summary.disputeCount },
            ]}
          />
          <section className="gm-detail-section">
            <h2>{t('To‘lovlar')}</h2>
            {refund.isSuccess && <Alert tone="success">{t('Qaytarish amalga oshirildi.')}</Alert>}
            {report.data && report.data.items.length === 0 && <EmptyState title={t('Bu davrda to‘lovlar yo‘q')} />}
            <div className="gm-list">
              {report.data?.items.map((row) => (
                <div
                  key={row.id}
                  className="gm-card gm-card--clickable gm-payment-card"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/admin/buyurtmalar/${row.orderId}`)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    navigate(`/admin/buyurtmalar/${row.orderId}`);
                  }}
                >
                  <div className="gm-payment-card__info">
                    <h3>{formatMoney(row.amount, row.currency)}</h3>
                    <p className="gm-card__meta">
                      {providerLabel(row.provider)} · {formatDateTime(row.succeededAt)}
                      {Number(row.refundedAmount) > 0 && t(' · Qaytarilgan: {money}', { money: formatMoney(row.refundedAmount, row.currency) })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      setTarget({ id: row.id, max: Number(row.amount) - Number(row.refundedAmount) });
                      setAmount('');
                    }}
                  >{t('Qaytarish')}</Button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title={t('To‘lovni qaytarish')}
        footer={
          <Button loading={refund.isPending} disabled={!amount || !note.trim()} onClick={submitRefund}>{t('Qaytarish')}</Button>
        }
      >
        <div className="gm-form">
          {refund.isError && <Alert tone="danger">{getErrorMessage(refund.error)}</Alert>}
          <Input
            label={t('Summa (maks. {p})', { p: target?.max ?? 0 })}
            type="number"
            min={1}
            max={target?.max}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Select label={t('Sabab')} options={REASONS} value={reason} onChange={(e) => setReason(e.target.value as RefundReason)} />
          <Input label={t('Izoh')} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
