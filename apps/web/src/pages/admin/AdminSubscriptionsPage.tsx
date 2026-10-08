import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, Check, Crown, Gift, Inbox, Receipt, Search, Undo2, Users, X, Zap } from 'lucide-react';
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
import { MediaViewer } from '@/features/media/components/MediaViewer';
import { useDebounce } from '@/hooks/useDebounce';
import { useAdminSubscriptionActions, useAdminSubscriptionSummary, useAdminSubscriptions, useSubscriptionUserSearch } from '@/features/subscription/hooks';
import type { AdminSubscriptionRow, PlanCode, SubscriptionStatus, SubscriptionUserHit } from '@/features/subscription/types';
import './AdminSubscriptionsPage.css';
import { t } from '@/i18n';

const TABS: Array<{ value: SubscriptionStatus | ''; label: () => string }> = [
  { value: '', label: () => t('Hammasi') },
  { value: 'PENDING', label: () => t('Kutilmoqda') },
  { value: 'ACTIVE', label: () => t('Faol') },
  { value: 'EXPIRED', label: () => t('Tugagan') },
  { value: 'REJECTED', label: () => t('Rad etilgan') },
  { value: 'CANCELED', label: () => t('Bekor qilingan') },
];
const PLAN_NAME: Record<string, string> = { CUSTOMER_PLUS: 'Plus', MASTER_PRO: 'Pro' };
const METHOD: Record<string, string> = { CLICK: 'Click', PAYME: 'Payme', UZUM: 'Uzum Bank', CARD: 'Karta' };
const AUTO = ['CLICK', 'PAYME', 'UZUM'];
const STATUS_BADGE: Record<string, { label: () => string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  PENDING: { label: () => t('Kutilmoqda'), tone: 'warning' },
  ACTIVE: { label: () => t('Faol'), tone: 'success' },
  EXPIRED: { label: () => t('Tugagan'), tone: 'neutral' },
  REJECTED: { label: () => t('Rad etilgan'), tone: 'danger' },
  CANCELED: { label: () => t('Bekor qilingan'), tone: 'neutral' },
};

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

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join('');
}

function UserPicker({ audience, value, onChange }: { audience: 'CUSTOMER' | 'MASTER'; value: SubscriptionUserHit | null; onChange: (user: SubscriptionUserHit | null) => void }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const query = useDebounce(text, 250);
  const search = useSubscriptionUserSearch(query.trim(), audience, open && !value);
  const items = search.data?.pages.flatMap((page) => page.items) ?? [];
  const pick = (user: SubscriptionUserHit) => {
    onChange(user);
    setOpen(false);
    setText('');
  };
  if (value) {
    return (
      <div className="gm-asub__field">
        <span className="gm-asub__label">{t('Foydalanuvchi')}</span>
        <div className="gm-asub__picked">
          <span className="gm-asub__avatar" aria-hidden="true">{initials(value.name)}</span>
          <span className="gm-asub__hit-text"><strong>{value.name}</strong><small>ID {value.accountNumber}{value.phone ? ` · ${value.phone}` : ''}</small></span>
          <Button variant="secondary" size="sm" onClick={() => onChange(null)}>{t('O‘zgartirish')}</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="gm-asub__field">
      <label className="gm-asub__label" htmlFor="gm-asub-user">{t('Foydalanuvchi')}</label>
      <div className="gm-asub__search">
        <Search size={16} aria-hidden="true" />
        <input
          id="gm-asub-user"
          autoComplete="off"
          autoFocus
          value={text}
          maxLength={80}
          placeholder={t('Ism, familiya, telefon yoki ID')}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setText(event.target.value); setOpen(true); }}
        />
      </div>
      {open && (
        <div className="gm-asub__results" role="listbox">
          {search.isLoading && <p className="gm-asub__hint">{t('Qidirilmoqda')}</p>}
          {search.isError && <p className="gm-asub__hint">{getErrorMessage(search.error)}</p>}
          {!search.isLoading && !search.isError && items.length === 0 && <p className="gm-asub__hint">{t('Hech kim topilmadi')}</p>}
          {!query.trim() && items.length > 0 && <p className="gm-asub__hint">{t('Yangi ro‘yxatdan o‘tganlar tepada')}</p>}
          {items.map((user) => (
            <button key={user.id} type="button" role="option" aria-selected={false} className="gm-asub__hit" onClick={() => pick(user)}>
              <span className="gm-asub__avatar" aria-hidden="true">{initials(user.name)}</span>
              <span className="gm-asub__hit-text">
                <strong>{user.name}</strong>
                <small>ID {user.accountNumber}{user.phone ? ` · ${user.phone}` : ''} · {formatDate(user.createdAt)}</small>
              </span>
              <span className="gm-asub__chips">
                {user.isMaster && <Badge tone="neutral">{t('Usta')}</Badge>}
                {user.plus && <Badge tone="primary">Plus</Badge>}
                {user.pro && <Badge tone="warning">Pro</Badge>}
              </span>
            </button>
          ))}
          {search.hasNextPage && (
            <Button variant="ghost" size="sm" loading={search.isFetchingNextPage} onClick={() => void search.fetchNextPage()}>{t('Yana ko‘rsatish')}</Button>
          )}
        </div>
      )}
    </div>
  );
}

function GrantDialog({ onClose }: { onClose: () => void }) {
  const { grant } = useAdminSubscriptionActions();
  const [user, setUser] = useState<SubscriptionUserHit | null>(null);
  const [planCode, setPlanCode] = useState<PlanCode>('CUSTOMER_PLUS');
  const [months, setMonths] = useState('1');
  const [note, setNote] = useState('');
  const audience = planCode === 'MASTER_PRO' ? 'MASTER' : 'CUSTOMER';
  return (
    <Modal
      open
      onClose={grant.isPending ? () => undefined : onClose}
      title={t('Obuna sovg‘a qilish')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={grant.isPending}>{t('Bekor qilish')}</Button>
          <Button loading={grant.isPending} disabled={!user} onClick={() => user && grant.mutate({ user: user.id, planCode, months: Number(months), note: note.trim() || undefined }, { onSuccess: onClose })}>
            <Gift size={16} aria-hidden="true" /> {t('Sovg‘a qilish')}
          </Button>
        </>
      }
    >
      <div className="gm-asub__dialog">
        {grant.isError && <Alert tone="danger">{getErrorMessage(grant.error)}</Alert>}
        <div className="gm-asub__two">
          <Select label={t('Reja')} value={planCode} onChange={(event) => { setPlanCode(event.target.value as PlanCode); setUser(null); }} options={[{ value: 'CUSTOMER_PLUS', label: t('Mijoz · Plus') }, { value: 'MASTER_PRO', label: t('Usta · Pro') }]} />
          <Select label={t('Muddat')} value={months} onChange={(event) => setMonths(event.target.value)} options={[1, 2, 3, 6, 12].map((value) => ({ value: String(value), label: value === 12 ? t('1 yil') : t('{months} oy', { months: value }) }))} />
        </div>
        <UserPicker audience={audience} value={user} onChange={setUser} />
        <Input label={t('Izoh (ixtiyoriy)')} value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} />
      </div>
    </Modal>
  );
}

function Row({ row }: { row: AdminSubscriptionRow }) {
  const { approve, reject, revoke } = useAdminSubscriptionActions();
  const [dialog, setDialog] = useState<'reject' | 'revoke' | null>(null);
  const error = approve.isError ? getErrorMessage(approve.error) : null;
  const auto = !!row.method && AUTO.includes(row.method);
  const waitingReceipt = row.status === 'PENDING' && row.method === 'CARD' && !row.receiptAssetId;
  const waitingPayment = row.status === 'PENDING' && auto;
  return (
    <article className="gm-asub__row">
      <div className="gm-asub__main">
        <div className="gm-asub__who">
          <Link to={`/admin/foydalanuvchilar/${row.user.accountNumber}`}>{row.user.name}</Link>
          <small>ID {row.user.accountNumber}{row.user.phone ? ` · ${row.user.phone}` : ''}</small>
        </div>
        <div className="gm-asub__plan">
          <Badge tone={row.audience === 'MASTER' ? 'warning' : 'primary'}><Crown size={13} /> {PLAN_NAME[row.planCode] ?? row.planCode}</Badge>
          <Badge tone={(STATUS_BADGE[row.status] ?? STATUS_BADGE.PENDING!).tone}>{(STATUS_BADGE[row.status] ?? STATUS_BADGE.PENDING!).label()}</Badge>
          {auto && row.paidAt && <Badge tone="success"><Zap size={13} /> {t('Avtomatik faollashgan')}</Badge>}
          <strong>{row.months === 12 ? t('1 yil') : t('{months} oy', { months: row.months })}</strong>
          <span>{row.source === 'GRANT' ? t('Sovg‘a') : formatMoney(row.amount, row.currency)}</span>
        </div>
        <div className="gm-asub__meta">
          {row.method && <span>{METHOD[row.method] ?? row.method}</span>}
          {row.providerTxId && <span>Tx: <code>{row.providerTxId}</code></span>}
          <span>{t('To‘lov ID')}: <code>{row.reference}</code></span>
          <span>{formatDateTime(row.createdAt)}</span>
          {row.endsAt && <span>{t('{date} gacha', { date: formatDate(row.endsAt) })}</span>}
          {row.rejectReason && <span className="gm-asub__reason">{row.rejectReason}</span>}
          {row.note && <span className="gm-asub__reason">{row.note}</span>}
        </div>
      </div>
      <div className="gm-asub__actions">
        {row.receiptAssetId && (
          <div className="gm-asub__receipt">
            <MediaViewer assetId={row.receiptAssetId} alt={t('To‘lov cheki')} label={t('To‘lov cheki')} />
            <span><Receipt size={13} aria-hidden="true" /> {t('Chek')}</span>
          </div>
        )}
        {waitingReceipt && <span className="gm-asub__wait">{t('Chek kutilmoqda')}</span>}
        {waitingPayment && <span className="gm-asub__wait">{t('To‘lov kutilmoqda')}</span>}
        {row.status === 'PENDING' && row.method === 'CARD' && !!row.receiptAssetId && (
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
  const [status, setStatus] = useState<SubscriptionStatus | ''>('PENDING');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState('');
  const [granting, setGranting] = useState(false);
  const list = useAdminSubscriptions(status, page, query, method);
  const summary = useAdminSubscriptionSummary().data;
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

      {summary && (
        <section className="gm-asub__stats" aria-label={t('Umumiy ko‘rsatkichlar')}>
          <div><span><Users size={16} aria-hidden="true" /> {t('Faol Plus mijozlar')}</span><strong>{summary.activeCustomers}</strong></div>
          <div><span><Crown size={16} aria-hidden="true" /> {t('Faol Pro ustalar')}</span><strong>{summary.activeMasters}</strong></div>
          <div className={summary.pendingReceipts > 0 ? 'is-alert' : undefined}><span><Receipt size={16} aria-hidden="true" /> {t('Ko‘rib chiqilishi kerak')}</span><strong>{summary.pendingReceipts}</strong></div>
          <div><span><Banknote size={16} aria-hidden="true" /> {t('Oxirgi 30 kun tushumi')}</span><strong>{formatMoney(summary.revenue30d, 'UZS')}</strong></div>
          <div><span><Banknote size={16} aria-hidden="true" /> {t('Jami tushum')}</span><strong>{formatMoney(summary.revenueTotal, 'UZS')}</strong></div>
          {summary.byMethod30d.length > 0 && (
            <ul className="gm-asub__methods" aria-label={t('Usullar bo‘yicha (30 kun)')}>
              {summary.byMethod30d.map((item) => (
                <li key={item.method}>{METHOD[item.method] ?? item.method} <b>{item.count}</b> · {formatMoney(item.amount, 'UZS')}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <form className="gm-asub__filters" onSubmit={(event) => { event.preventDefault(); setQuery(search); setPage(1); }}>
        <Input label={t('Qidirish')} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Ism, telefon, ID yoki kod')} />
        <Select label={t('To‘lov usuli')} value={method} onChange={(event) => { setMethod(event.target.value); setPage(1); }} options={[{ value: '', label: t('Hammasi') }, ...Object.entries(METHOD).map(([value, label]) => ({ value, label }))]} />
        <Button type="submit" variant="secondary"><Search size={16} aria-hidden="true" /> {t('Qidirish')}</Button>
      </form>

      <div className="gm-asub__tabs" role="tablist">
        {TABS.map((tab) => (
          <button key={tab.value} type="button" role="tab" aria-selected={status === tab.value} className={cx('gm-asub__tab', status === tab.value && 'is-active')} onClick={() => { setStatus(tab.value); setPage(1); }}>
            {tab.label()}
            <b>{tab.value ? (data?.counts[tab.value] ?? 0) : Object.values(data?.counts ?? {}).reduce((sum, count) => sum + (count ?? 0), 0)}</b>
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
