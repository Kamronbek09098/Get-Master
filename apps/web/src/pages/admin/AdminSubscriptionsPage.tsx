import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Crown, Gift, Inbox, Undo2, X } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDate, formatDateTime, formatMoney } from '@/lib/utils';
import { useAdminSubscriptionActions, useAdminSubscriptions } from '@/features/subscription/hooks';
import type { AdminSubscriptionRow, PlanCode, SubscriptionStatus } from '@/features/subscription/types';
import './AdminSubscriptionsPage.css';
import { t } from '@/i18n';

const TABS: Array<{ value: SubscriptionStatus; label: () => string }> = [
  { value: 'PENDING', label: () => t('Kutilmoqda') },
  { value: 'ACTIVE', label: () => t('Faol') },
  { value: 'EXPIRED', label: () => t('Tugagan') },
  { value: 'REJECTED', label: () => t('Rad etilgan') },
  { value: 'CANCELED', label: () => t('Bekor qilingan') },
];
const PLAN_NAME: Record<string, string> = { CUSTOMER_PLUS: 'Plus', MASTER_PRO: 'Pro' };
const METHOD: Record<string, string> = { CLICK: 'Click', PAYME: 'Payme', UZUM: 'Uzum Bank', CARD: 'Karta' };

function ReasonDialog({ title, confirm, busy, error, onSubmit, onClose }: { title: string; confirm: string; busy: boolean; error: string | null; onSubmit: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t('Bekor qilish')}</Button>
          <Button loading={busy} disabled={reason.trim().length < 3} onClick={() => onSubmit(reason.trim())}>{confirm}</Button>
        </>
      }
    >
      <div className="gm-asub__dialog">
        {error && <Alert tone="danger">{error}</Alert>}
        <Input label={t('Sabab')} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} autoFocus />
        <p>{t('Sabab foydalanuvchiga ko‘rsatiladi.')}</p>
      </div>
    </Modal>
  );
}

function GrantDialog({ onClose }: { onClose: () => void }) {
  const { grant } = useAdminSubscriptionActions();
  const [user, setUser] = useState('');
  const [planCode, setPlanCode] = useState<PlanCode>('CUSTOMER_PLUS');
  const [months, setMonths] = useState('1');
  const [note, setNote] = useState('');
  return (
    <Modal
      open
      onClose={grant.isPending ? () => undefined : onClose}
      title={t('Obuna sovg‘a qilish')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={grant.isPending}>{t('Bekor qilish')}</Button>
          <Button loading={grant.isPending} disabled={!user.trim()} onClick={() => grant.mutate({ user: user.trim(), planCode, months: Number(months), note: note.trim() || undefined }, { onSuccess: onClose })}>
            <Gift size={16} aria-hidden="true" /> {t('Sovg‘a qilish')}
          </Button>
        </>
      }
    >
      <div className="gm-asub__dialog">
        {grant.isError && <Alert tone="danger">{getErrorMessage(grant.error)}</Alert>}
        <Input label={t('Foydalanuvchi ID raqami')} inputMode="numeric" value={user} onChange={(event) => setUser(event.target.value)} maxLength={40} autoFocus />
        <div className="gm-asub__two">
          <Select label={t('Reja')} value={planCode} onChange={(event) => setPlanCode(event.target.value as PlanCode)} options={[{ value: 'CUSTOMER_PLUS', label: t('Mijoz · Plus') }, { value: 'MASTER_PRO', label: t('Usta · Pro') }]} />
          <Select label={t('Muddat')} value={months} onChange={(event) => setMonths(event.target.value)} options={[1, 2, 3, 6, 12].map((value) => ({ value: String(value), label: value === 12 ? t('1 yil') : t('{months} oy', { months: value }) }))} />
        </div>
        <Input label={t('Izoh (ixtiyoriy)')} value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} />
      </div>
    </Modal>
  );
}

function Row({ row }: { row: AdminSubscriptionRow }) {
  const { approve, reject, revoke } = useAdminSubscriptionActions();
  const [dialog, setDialog] = useState<'reject' | 'revoke' | null>(null);
  const error = approve.isError ? getErrorMessage(approve.error) : null;
  return (
    <article className="gm-asub__row">
      <div className="gm-asub__main">
        <div className="gm-asub__who">
          <Link to={`/admin/foydalanuvchilar/${row.user.accountNumber}`}>{row.user.name}</Link>
          <small>ID {row.user.accountNumber}{row.user.phone ? ` · ${row.user.phone}` : ''}</small>
        </div>
        <div className="gm-asub__plan">
          <Badge tone={row.audience === 'MASTER' ? 'warning' : 'primary'}><Crown size={13} /> {PLAN_NAME[row.planCode] ?? row.planCode}</Badge>
          <strong>{row.months === 12 ? t('1 yil') : t('{months} oy', { months: row.months })}</strong>
          <span>{row.source === 'GRANT' ? t('Sovg‘a') : formatMoney(row.amount, row.currency)}</span>
        </div>
        <div className="gm-asub__meta">
          {row.method && <span>{METHOD[row.method] ?? row.method}</span>}
          <code>{row.reference}</code>
          <span>{formatDateTime(row.createdAt)}</span>
          {row.endsAt && <span>{t('{date} gacha', { date: formatDate(row.endsAt) })}</span>}
          {row.rejectReason && <span className="gm-asub__reason">{row.rejectReason}</span>}
          {row.note && <span className="gm-asub__reason">{row.note}</span>}
        </div>
      </div>
      <div className="gm-asub__actions">
        {row.status === 'PENDING' && (
          <>
            <Button size="sm" loading={approve.isPending} onClick={() => approve.mutate(row.id)}><Check size={15} aria-hidden="true" /> {t('Tasdiqlash')}</Button>
            <Button size="sm" variant="secondary" onClick={() => setDialog('reject')}><X size={15} aria-hidden="true" /> {t('Rad etish')}</Button>
          </>
        )}
        {row.status === 'ACTIVE' && (
          <Button size="sm" variant="secondary" onClick={() => setDialog('revoke')}><Undo2 size={15} aria-hidden="true" /> {t('Bekor qilish')}</Button>
        )}
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {dialog === 'reject' && (
        <ReasonDialog title={t('So‘rovni rad etish')} confirm={t('Rad etish')} busy={reject.isPending} error={reject.isError ? getErrorMessage(reject.error) : null} onClose={() => setDialog(null)} onSubmit={(reason) => reject.mutate({ id: row.id, reason }, { onSuccess: () => setDialog(null) })} />
      )}
      {dialog === 'revoke' && (
        <ReasonDialog title={t('Obunani bekor qilish')} confirm={t('Bekor qilish')} busy={revoke.isPending} error={revoke.isError ? getErrorMessage(revoke.error) : null} onClose={() => setDialog(null)} onSubmit={(reason) => revoke.mutate({ id: row.id, reason }, { onSuccess: () => setDialog(null) })} />
      )}
    </article>
  );
}

/** Admin: obuna to‘lov so‘rovlarini tasdiqlash/rad etish, faol obunalarni ko‘rish va sovg‘a qilish. */
export function AdminSubscriptionsPage() {
  const [status, setStatus] = useState<SubscriptionStatus>('PENDING');
  const [page, setPage] = useState(1);
  const [granting, setGranting] = useState(false);
  const list = useAdminSubscriptions(status, page);
  const data = list.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="gm-asub">
      <div className="gm-page-header">
        <div>
          <h1>{t('Obunalar')}</h1>
          <p className="gm-page-lead">{t('Mijoz «Plus» va usta «Pro» obunalari: to‘lov so‘rovlarini tasdiqlang yoki obunani sovg‘a qiling.')}</p>
        </div>
        <Button onClick={() => setGranting(true)}><Gift size={17} aria-hidden="true" /> {t('Obuna sovg‘a qilish')}</Button>
      </div>

      <div className="gm-asub__tabs" role="tablist">
        {TABS.map((tab) => (
          <button key={tab.value} type="button" role="tab" aria-selected={status === tab.value} className={cx('gm-asub__tab', status === tab.value && 'is-active')} onClick={() => { setStatus(tab.value); setPage(1); }}>
            {tab.label()}
            <b>{data?.counts[tab.value] ?? 0}</b>
          </button>
        ))}
      </div>

      {list.isLoading && <PageLoader />}
      {list.isError && <Alert tone="danger">{getErrorMessage(list.error)}</Alert>}
      {data && data.items.length === 0 && <EmptyState icon={<Inbox size={30} />} title={t('Bu bo‘limda obunalar yo‘q')} />}
      <div className="gm-asub__list">
        {data?.items.map((row) => <Row key={row.id} row={row} />)}
      </div>
      {pages > 1 && (
        <div className="gm-asub__pager">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t('Oldingi')}</Button>
          <span>{page} / {pages}</span>
          <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>{t('Keyingi')}</Button>
        </div>
      )}
      {granting && <GrantDialog onClose={() => setGranting(false)} />}
    </div>
  );
}
