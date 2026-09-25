import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime, formatMoney } from '@/lib/utils';
import { useRefund, useRevenueReport } from '@/features/admin/hooks/useAdmin';
import { StatGrid } from '@/features/admin/components/StatGrid';
import { DateRangeFilter } from '@/features/admin/components/DateRangeFilter';
import { toRange } from '@/features/admin/range';
import type { RefundReason } from '@/types/common';

const REASONS: Array<{ value: RefundReason; label: string }> = [
  { value: 'CUSTOMER_REQUEST', label: 'Mijoz talabi' },
  { value: 'DISPUTE', label: 'Nizo' },
  { value: 'CANCELLATION', label: 'Bekor qilish' },
  { value: 'WARRANTY', label: 'Kafolat' },
  { value: 'ADMIN_DECISION', label: 'Admin qarori' },
  { value: 'PAYMENT_ERROR', label: 'To‘lov xatosi' },
  { value: 'OTHER', label: 'Boshqa' },
];

export function AdminReportsPage() {
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
      { id: target.id, amount: Number(amount), reason, note: note.trim() },
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
          <h1>Hisobotlar</h1>
          <p className="gm-page-lead">Daromad va faoliyat hisobotlari.</p>
        </div>
      </div>
      <DateRangeFilter value={range} onChange={setRange} />
      {report.isLoading && <PageLoader label="Hisobot yuklanmoqda…" />}
      {report.isError && <Alert tone="danger">{getErrorMessage(report.error)}</Alert>}
      {summary && (
        <>
          <StatGrid
            items={[
              { label: 'Jami tushum', value: formatMoney(summary.totalRevenue) },
              { label: 'Qaytarilgan', value: formatMoney(summary.totalRefunded) },
              { label: 'Sof tushum', value: formatMoney(summary.netRevenue) },
              { label: 'To‘lovlar', value: summary.totalPayments },
              { label: 'Buyurtmalar', value: summary.totalOrders },
              { label: 'Yakunlangan', value: summary.completedOrders },
              { label: 'Bekor qilingan', value: summary.cancelledOrders },
              { label: 'Nizolar', value: summary.disputeCount },
            ]}
          />
          <section className="gm-detail-section">
            <h2>To‘lovlar</h2>
            {refund.isSuccess && <Alert tone="success">Qaytarish amalga oshirildi.</Alert>}
            {report.data && report.data.items.length === 0 && <EmptyState title="Bu davrda to‘lovlar yo‘q" />}
            <div className="gm-list">
              {report.data?.items.map((row) => (
                <div key={row.id} className="gm-card">
                  <div className="gm-card__header">
                    <h3>{formatMoney(row.amount, row.currency)}</h3>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setTarget({ id: row.id, max: Number(row.amount) - Number(row.refundedAmount) });
                        setAmount('');
                      }}
                    >
                      Qaytarish
                    </Button>
                  </div>
                  <p className="gm-card__meta">
                    {row.provider} · {formatDateTime(row.succeededAt)} · Buyurtma: {row.orderId}
                    {Number(row.refundedAmount) > 0 && ` · Qaytarilgan: ${formatMoney(row.refundedAmount, row.currency)}`}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title="To‘lovni qaytarish"
        footer={
          <Button loading={refund.isPending} disabled={!amount || !note.trim()} onClick={submitRefund}>
            Qaytarish
          </Button>
        }
      >
        <div className="gm-form">
          {refund.isError && <Alert tone="danger">{getErrorMessage(refund.error)}</Alert>}
          <Input
            label={`Summa (maks. ${target?.max ?? 0})`}
            type="number"
            min={1}
            max={target?.max}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Select label="Sabab" options={REASONS} value={reason} onChange={(e) => setReason(e.target.value as RefundReason)} />
          <Input label="Izoh" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
