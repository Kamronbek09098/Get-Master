import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Download, Eye, Filter, LayoutGrid, List, MoreHorizontal, Package, Pencil, RotateCcw, Search, Wallet, Workflow } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDate, formatDateTime, formatMoney, formatNumber, formatRelativeTime, formatTime } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { useAppStore } from '@/store/app.store';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { OrderStatus } from '@/features/order/components/OrderStatus';
import { useAdminOrderFacets, useAdminOrdersPage, useAdminOrdersSummary, useBulkCancelOrders } from '@/features/admin/hooks/useAdmin';
import { adminService } from '@/features/admin/services/admin.service';
import { OrderDrawer } from '@/features/admin/orders/OrderDrawer';
import { pageNumbers } from '@/features/admin/users/users-ui';
import type { AdminOrderFilters, AdminOrderRow, AdminOrderStatus } from '@/features/admin/types';
import { PAYMENT_STATUS_LABEL, providerLabel } from '@/features/payment/labels';
import type { PaymentStatus } from '@/types/common';
import './AdminUsersPage.css';
import '@/features/admin/list-shared.css';
import './AdminOrdersPage.css';
import { t } from '@/i18n';

const STATUS_OPTIONS: AdminOrderStatus[] = ['BOOKED', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'WAITING_CONFIRMATION', 'COMPLETED', 'CANCELLED', 'DISPUTED'];
const STATUS_LABEL: Partial<Record<AdminOrderStatus, string>> = {
  BOOKED: t('Band qilingan'),
  CONFIRMED: t('Tasdiqlangan'),
  ON_THE_WAY: t('Yo‘lda'),
  ARRIVED: t('Yetib kelgan'),
  IN_PROGRESS: t('Jarayonda'),
  WAITING_CONFIRMATION: t('Tasdiq kutilmoqda'),
  COMPLETED: t('Yakunlangan'),
  CANCELLED: t('Bekor qilingan'),
  DISPUTED: t('Nizoli'),
};
const PAYMENT_OPTIONS: Array<{ value: PaymentStatus | 'NONE'; label: string }> = [
  { value: 'SUCCEEDED', label: t('To‘langan') },
  { value: 'PENDING', label: t('Kutilmoqda') },
  { value: 'PROCESSING', label: t('Jarayonda') },
  { value: 'FAILED', label: t('Muvaffaqiyatsiz') },
  { value: 'REFUNDED', label: t('Qaytarilgan') },
  { value: 'PARTIALLY_REFUNDED', label: t('Qisman qaytarilgan') },
  { value: 'CANCELLED', label: t('Bekor qilingan') },
  { value: 'NONE', label: t('To‘lov yo‘q') },
];
const PAYMENT_TONE: Record<string, BadgeTone> = { SUCCEEDED: 'success', PENDING: 'warning', PROCESSING: 'warning', FAILED: 'danger', CANCELLED: 'neutral', REFUNDED: 'neutral', PARTIALLY_REFUNDED: 'warning' };
const SORTS = [
  { value: 'createdAt:desc', label: t('Yangi buyurtmalar') },
  { value: 'createdAt:asc', label: t('Eski buyurtmalar') },
  { value: 'amount:desc', label: t('Summa: kattadan kichikka') },
  { value: 'amount:asc', label: t('Summa: kichikdan kattaga') },
];
const CANCELLABLE: AdminOrderStatus[] = ['BOOKED', 'CONFIRMED'];
const dayStart = (value: string) => (value ? new Date(`${value}T00:00:00`).toISOString() : undefined);
const dayEnd = (value: string) => (value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined);
const csvCell = (value: string | number | null | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function Trend({ change, hint }: { change: number | null; hint?: string }) {
  if (change === null || change === 0) return null;
  return <em className={change > 0 ? 'is-up' : 'is-down'} title={hint}>{change > 0 ? '↑' : '↓'} {Math.abs(change)}%</em>;
}

function PaymentBadge({ payment }: { payment: AdminOrderRow['payment'] }) {
  if (!payment) return <Badge tone="neutral">{t('To‘lov yo‘q')}</Badge>;
  return <Badge tone={PAYMENT_TONE[payment.status] ?? 'neutral'}>{PAYMENT_STATUS_LABEL[payment.status] ?? payment.status}</Badge>;
}

function BulkCancelDialog({ ids, onClose, onDone }: { ids: string[]; onClose: () => void; onDone: () => void }) {
  const bulk = useBulkCancelOrders();
  const pushToast = useAppStore((state) => state.pushToast);
  const [reason, setReason] = useState('');
  return (
    <Modal
      open
      onClose={bulk.isPending ? () => undefined : onClose}
      title={t('Tanlangan buyurtmalarni bekor qilish')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={bulk.isPending}>{t('Ortga')}</Button>
          <Button
            variant="danger"
            loading={bulk.isPending}
            disabled={reason.trim().length < 3}
            onClick={() =>
              bulk.mutate(
                { ids, reason: reason.trim() },
                {
                  onSuccess: (result) => {
                    pushToast(result.failed.length ? t('{ok} ta bekor qilindi, {fail} ta bajarilmadi', { ok: result.cancelled, fail: result.failed.length }) : t('{ok} ta buyurtma bekor qilindi', { ok: result.cancelled }), result.failed.length ? 'info' : 'success');
                    onDone();
                  },
                },
              )
            }
          >
            {t('Bekor qilish')}
          </Button>
        </>
      }
    >
      <div className="gm-form">
        <Alert tone="warning">{t('{count} ta buyurtma bekor qilinadi, mijoz va usta xabardor qilinadi. Faqat «Band qilingan» va «Tasdiqlangan» buyurtmalarni bekor qilish mumkin.', { count: ids.length })}</Alert>
        {bulk.isError && <Alert tone="danger">{getErrorMessage(bulk.error)}</Alert>}
        <Textarea label={t('Sabab')} required rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} hint={t('Kamida 3 ta belgi. Audit jurnaliga va tomonlarga yoziladi.')} />
      </div>
    </Modal>
  );
}

export function AdminOrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pushToast = useAppStore((state) => state.pushToast);
  const [searchParams] = useSearchParams();
  const urlStatus = searchParams.get('status');
  const [status, setStatus] = useState<AdminOrderStatus | ''>(STATUS_OPTIONS.includes(urlStatus as AdminOrderStatus) ? (urlStatus as AdminOrderStatus) : '');
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [from, setFrom] = useState(/^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('from') ?? '') ? (searchParams.get('from') as string) : '');
  const [to, setTo] = useState(/^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('to') ?? '') ? (searchParams.get('to') as string) : '');
  const [flagged, setFlagged] = useState(searchParams.get('flagged') === 'true');
  const [ongoing, setOngoing] = useState(searchParams.get('ongoing') === 'true' && !urlStatus);
  const [payment, setPayment] = useState<PaymentStatus | 'NONE' | ''>('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [sortValue, setSortValue] = useState('createdAt:desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<AdminOrderRow | null>(null);
  const [bulkCancel, setBulkCancel] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const debounced = useDebounce(search.trim(), 400);

  const [sort, dir] = sortValue.split(':') as ['createdAt' | 'amount', 'asc' | 'desc'];
  const filters = useMemo<AdminOrderFilters>(
    () => ({ status: status || undefined, search: debounced || undefined, from: dayStart(from), to: dayEnd(to), flagged: flagged ? 'true' : undefined, ongoing: ongoing ? 'true' : undefined, payment: payment || undefined, category: category || undefined, city: city || undefined, sort, dir }),
    [status, debounced, from, to, flagged, ongoing, payment, category, city, sort, dir],
  );
  const orders = useAdminOrdersPage(filters, page, pageSize);
  const summary = useAdminOrdersSummary();
  const facets = useAdminOrderFacets();
  const data = orders.data;
  const items = data?.items ?? [];
  const s = summary.data;
  const counts = s?.counts ?? {};

  /** Yuqoridagi kartalar bir-birini istisno qiladi: biri tanlanganda qolganlari tozalanadi. */
  function selectView(next: { status?: AdminOrderStatus | ''; flagged?: boolean; ongoing?: boolean }) {
    setStatus(next.status ?? '');
    setFlagged(next.flagged ?? false);
    setOngoing(next.ongoing ?? false);
  }

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [filters, pageSize]);
  useEffect(() => setSelected(new Set()), [page]);
  useEffect(() => {
    if (!dateOpen && !filtersOpen) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (dateRef.current && !dateRef.current.contains(target)) setDateOpen(false);
      if (filterRef.current && !filterRef.current.contains(target)) setFiltersOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [dateOpen, filtersOpen]);

  const advanced = [flagged, ongoing].filter(Boolean).length;
  const dirty = !!(status || search || from || to || flagged || ongoing || payment || category || city);
  const reset = () => {
    selectView({});
    setSearch('');
    setFrom('');
    setTo('');
    setPayment('');
    setCategory('');
    setCity('');
    setSortValue('createdAt:desc');
  };
  const dateLabel = from || to ? `${from ? formatDate(from) : '…'} – ${to ? formatDate(to) : '…'}` : t('Barcha vaqt');

  const cancellable = items.filter((order) => CANCELLABLE.includes(order.status));
  const allSelected = cancellable.length > 0 && cancellable.every((order) => selected.has(order.id));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Joriy filtrlarga mos BARCHA buyurtmalarni CSV (Excel ochadi) qilib yuklaydi. */
  async function exportCsv() {
    setExporting(true);
    try {
      const rows: AdminOrderRow[] = [];
      for (let p = 1; p <= 100; p += 1) {
        const chunk = await adminService.ordersPage(filters, p, 100);
        rows.push(...chunk.items);
        if (p >= chunk.pages) break;
      }
      const head = ['№', t('Yaratilgan'), t('Mijoz'), t('Mijoz telefoni'), t('Usta'), t('Usta telefoni'), t('Xizmat turi'), t('So‘rov'), t('Hudud'), t('Summa'), t('Valyuta'), t('To‘lov usuli'), t('To‘lov holati'), t('Holat')];
      const lines = rows.map((o) =>
        [o.orderNumber, formatDateTime(o.createdAt), accountName(o.customer), o.customer.phone, accountName(o.master.user), o.master.user.phone, o.category?.name, o.title, o.city, o.finalAmount, o.currency, o.payment ? providerLabel(o.payment.provider) : '', o.payment ? PAYMENT_STATUS_LABEL[o.payment.status] : t('To‘lov yo‘q'), STATUS_LABEL[o.status] ?? o.status].map(csvCell).join(','),
      );
      const blob = new Blob([`﻿${[head.map(csvCell).join(','), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `buyurtmalar-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      pushToast(t('{count} ta buyurtma eksport qilindi', { count: rows.length }), 'success');
    } catch (error) {
      pushToast(getErrorMessage(error), 'error');
    } finally {
      setExporting(false);
    }
  }

  const rowMenu = (order: AdminOrderRow) => [
    { label: t('Buyurtmani ochish'), icon: <Pencil size={16} />, onSelect: () => navigate(`/admin/buyurtmalar/${order.id}`) },
    { label: t('Mijoz profili'), icon: <Eye size={16} />, onSelect: () => navigate(`/admin/foydalanuvchilar/${order.customer.accountNumber}`) },
    { label: t('Usta profili'), icon: <Eye size={16} />, onSelect: () => navigate(`/admin/foydalanuvchilar/${order.master.user.accountNumber}`) },
    ...(CANCELLABLE.includes(order.status) ? [{ label: t('Bekor qilish'), icon: <Ban size={16} />, onSelect: () => setDrawer(order), danger: true, separator: true }] : []),
  ];
  const rowActions = (order: AdminOrderRow) => (
    <span className="gm-ul__acts" onClick={(event) => event.stopPropagation()}>
      <button type="button" aria-label={t('Tezkor ko‘rish')} title={t('Tezkor ko‘rish')} onClick={() => setDrawer(order)}><Eye size={16} /></button>
      <button type="button" aria-label={t('Buyurtmani ochish')} title={t('Buyurtmani ochish')} onClick={() => navigate(`/admin/buyurtmalar/${order.id}`)}><Pencil size={15} /></button>
      <Dropdown triggerClassName="gm-ul__more" label={t('Boshqa amallar')} trigger={<MoreHorizontal size={17} />} items={rowMenu(order)} />
    </span>
  );
  const person = (user: AdminOrderRow['customer'], sub: string) => (
    <div className="gm-ul__user">
      <ChatAvatar name={accountName(user)} seed={user.id} size="md" src={user.avatar} />
      <div>
        <strong>{accountName(user)}</strong>
        <small>{sub}</small>
      </div>
    </div>
  );

  return (
    <div className="gm-ul gm-ord2">
      <header className="gm-ul__head gm-adm2__head">
        <span className="gm-adm2__logo"><ClipboardList size={26} aria-hidden="true" /></span>
        <div>
          <h1>{t('Buyurtmalar')}</h1>
          <p>{t('Barcha buyurtmalar, to‘lovlar va nizolarni boshqarish')}</p>
        </div>
        <div className="gm-ord2__date gm-adm2__create" ref={dateRef}>
          <Button variant="secondary" onClick={() => setDateOpen((open) => !open)} aria-expanded={dateOpen}>
            <CalendarDays size={16} aria-hidden="true" /> {dateLabel}
          </Button>
          {dateOpen && (
            <div className="gm-ul__pop gm-ord2__datepop">
              <label>
                <span>{t('Sanadan')}</span>
                <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
              </label>
              <label>
                <span>{t('Sanagacha')}</span>
                <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
              </label>
              {(from || to) && <Button size="sm" variant="ghost" onClick={() => { setFrom(''); setTo(''); }}>{t('Barcha vaqt')}</Button>}
            </div>
          )}
        </div>
      </header>

      <div className="gm-ul__kpis gm-ord2__kpis">
        <button type="button" className={cx('gm-ukpi gm-ukpi--btn', !status && !flagged && !ongoing && 'is-on')} onClick={() => selectView({})} aria-pressed={!status && !flagged && !ongoing}>
          <span className="gm-ukpi__icon gm-ukpi__icon--blue"><Package size={24} aria-hidden="true" /></span>
          <div>
            <small>{t('Jami buyurtmalar')}</small>
            <strong>{s ? formatNumber(s.total) : '…'}{s && <Trend change={s.weekAgoTotal > 0 ? Math.round(((s.total - s.weekAgoTotal) / s.weekAgoTotal) * 100) : null} hint={t('Bir hafta oldingiga nisbatan')} />}</strong>
            <span>{t('O‘tgan hafta: {count}', { count: s ? formatNumber(s.weekAgoTotal) : '…' })}</span>
          </div>
        </button>
        <button type="button" className={cx('gm-ukpi gm-ukpi--btn', ongoing && 'is-on')} onClick={() => selectView({ ongoing: true })} aria-pressed={ongoing}>
          <span className="gm-ukpi__icon gm-ukpi__icon--green"><Workflow size={24} aria-hidden="true" /></span>
          <div>
            <small>{t('Jarayonda')}</small>
            <strong>{s ? formatNumber(s.active) : '…'}{s && <Trend change={s.trends.active.changePercent} hint={t('Oxirgi 7 kunda yaratilganlar oldingi 7 kunga nisbatan')} />}</strong>
            <span>{t('Oxirgi 7 kunda yangi: {count}', { count: s?.trends.active.current ?? '…' })}</span>
          </div>
        </button>
        <button type="button" className={cx('gm-ukpi gm-ukpi--btn', flagged && 'is-on')} onClick={() => selectView({ flagged: true })} aria-pressed={flagged}>
          <span className="gm-ukpi__icon gm-ukpi__icon--red"><AlertTriangle size={24} aria-hidden="true" /></span>
          <div>
            <small>{t('Nizoli / shikoyatli')}</small>
            <strong>{s ? formatNumber(s.flagged) : '…'}{s && <Trend change={s.trends.flagged.changePercent} />}</strong>
            <span>{t('Oxirgi 7 kunda yangi: {count}', { count: s?.trends.flagged.current ?? '…' })}</span>
          </div>
        </button>
        <button type="button" className={cx('gm-ukpi gm-ukpi--btn', status === 'COMPLETED' && 'is-on')} onClick={() => selectView({ status: 'COMPLETED' })} aria-pressed={status === 'COMPLETED'}>
          <span className="gm-ukpi__icon gm-ukpi__icon--green"><CheckCircle2 size={24} aria-hidden="true" /></span>
          <div>
            <small>{t('Yakunlangan')}</small>
            <strong>{s ? formatNumber(counts.COMPLETED ?? 0) : '…'}{s && <Trend change={s.trends.completed.changePercent} hint={t('Oxirgi 7 kunda yakunlanganlar oldingi 7 kunga nisbatan')} />}</strong>
            <span>{t('Oxirgi 7 kunda: {count}', { count: s?.trends.completed.current ?? '…' })}</span>
          </div>
        </button>
        <button type="button" className={cx('gm-ukpi gm-ukpi--btn', status === 'COMPLETED' && 'is-on')} onClick={() => selectView({ status: 'COMPLETED' })} aria-pressed={status === 'COMPLETED'}>
          <span className="gm-ukpi__icon gm-ukpi__icon--amber"><Wallet size={24} aria-hidden="true" /></span>
          <div>
            <small>{t('Yakunlanganlar summasi')}</small>
            <strong className="gm-ord2__money">{s ? formatMoney(s.completedAmount) : '…'}{s && <Trend change={s.trends.amount.changePercent} hint={t('Oxirgi 7 kunda yakunlanganlar summasi oldingi 7 kunga nisbatan')} />}</strong>
            <span>{t('Oxirgi 7 kunda: {amount}', { amount: s ? formatMoney(s.trends.amount.current) : '…' })}</span>
          </div>
        </button>
      </div>

      <section className="gm-ul__panel">
        <div className="gm-ul__toolbar">
          <label className="gm-ul__search">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Buyurtma №, mijoz yoki usta ID/ismi/telefoni, so‘rov nomi...')} aria-label={t('Qidirish')} autoComplete="off" />
          </label>
          <label className="gm-ul__select">
            <span>{t('Status')}</span>
            <select value={status} onChange={(event) => selectView({ status: event.target.value as AdminOrderStatus | '' })}>
              <option value="">{t('Barcha statuslar')}</option>
              {STATUS_OPTIONS.map((value) => <option key={value} value={value}>{STATUS_LABEL[value]}{counts[value] ? ` (${counts[value]})` : ''}</option>)}
            </select>
          </label>
          <label className="gm-ul__select">
            <span>{t('To‘lov holati')}</span>
            <select value={payment} onChange={(event) => setPayment(event.target.value as PaymentStatus | 'NONE' | '')}>
              <option value="">{t('Barcha to‘lovlar')}</option>
              {PAYMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="gm-ul__select">
            <span>{t('Xizmat turi')}</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">{t('Barchasi')}</option>
              {(facets.data?.categories ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.count})</option>)}
            </select>
          </label>
          <label className="gm-ul__select">
            <span>{t('Hudud')}</span>
            <select value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="">{t('Barcha hududlar')}</option>
              {(facets.data?.cities ?? []).map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}
            </select>
          </label>
          <div className="gm-ul__filters" ref={filterRef}>
            <Button variant="secondary" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
              <Filter size={16} aria-hidden="true" /> {t('Filtrlar')}{advanced > 0 && <span className="gm-ul__count">{advanced}</span>}
            </Button>
            {filtersOpen && (
              <div className="gm-ul__pop">
                <label className="gm-ord2__check"><input type="checkbox" checked={flagged} onChange={(event) => selectView({ flagged: event.target.checked })} /> {t('Faqat nizoli / shikoyatli')}</label>
                <label className="gm-ord2__check"><input type="checkbox" checked={ongoing} onChange={(event) => selectView({ ongoing: event.target.checked })} /> {t('Faqat jarayondagilar')}</label>
              </div>
            )}
          </div>
          <Button variant="ghost" onClick={reset} disabled={!dirty}>
            <RotateCcw size={15} aria-hidden="true" /> {t('Tozalash')}
          </Button>
        </div>

        <div className="gm-ul__bulk">
          <label className="gm-ul__check">
            <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(cancellable.map((order) => order.id)))} disabled={cancellable.length === 0} />
            <span>{selected.size > 0 ? t('Tanlandi: {count}', { count: selected.size }) : t('Tanlash')}</span>
          </label>
          <label className="gm-ord2__sort">
            <span>{t('Saralash')}:</span>
            <select value={sortValue} onChange={(event) => setSortValue(event.target.value)}>
              {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <Dropdown
            triggerClassName="gm-ul__menu-btn"
            label={t('Ommaviy amallar')}
            trigger={<>{t('Ommaviy amallar')} <ChevronDown size={15} aria-hidden="true" /></>}
            items={[{ label: t('Tanlanganlarni bekor qilish'), icon: <Ban size={16} />, danger: true, onSelect: () => selected.size > 0 && setBulkCancel(true) }]}
          />
          <Button variant="secondary" size="sm" loading={exporting} onClick={() => void exportCsv()} disabled={!data || data.total === 0}>
            <Download size={15} aria-hidden="true" /> {t('Eksport (CSV)')}
          </Button>
          {selected.size === 0 && <small className="gm-ul__hint">{t('Bekor qilish uchun «Band qilingan» yoki «Tasdiqlangan» buyurtmalarni belgilang.')}</small>}
          <span className="gm-adm2__views" role="group" aria-label={t('Ko‘rinish')}>
            <button type="button" className={cx(view === 'list' && 'is-on')} aria-pressed={view === 'list'} onClick={() => setView('list')} aria-label={t('Jadval')}><List size={17} /></button>
            <button type="button" className={cx(view === 'grid' && 'is-on')} aria-pressed={view === 'grid'} onClick={() => setView('grid')} aria-label={t('Kartalar')}><LayoutGrid size={17} /></button>
          </span>
        </div>

        {orders.isLoading && <PageLoader label={t('Buyurtmalar yuklanmoqda…')} />}
        {orders.isError && <Alert tone="danger">{getErrorMessage(orders.error)}</Alert>}
        {data && items.length === 0 && <EmptyState icon={<Search size={28} />} title={t('Buyurtma topilmadi')} description={dirty ? t('Filtrlarni o‘zgartirib ko‘ring.') : undefined} />}

        {items.length > 0 && view === 'list' && (
          <div className={cx('gm-ul__table', orders.isFetching && 'is-loading')}>
            <table>
              <thead>
                <tr>
                  <th className="gm-ul__c-check" />
                  <th className="gm-ul__c-num">#</th>
                  <th>{t('Buyurtma ID')}</th>
                  <th>{t('Mijoz')}</th>
                  <th>{t('Usta')}</th>
                  <th className="gm-ul__c-phone">{t('Xizmat turi')}</th>
                  <th>{t('Summa')}</th>
                  <th>{t('To‘lov')}</th>
                  <th>{t('Status')}</th>
                  <th className="gm-ul__c-last">{t('Yaratilgan')}</th>
                  <th className="gm-ul__c-act">{t('Amallar')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((order, index) => {
                  const canSelect = CANCELLABLE.includes(order.status);
                  return (
                    <tr key={order.id} className={cx(drawer?.id === order.id && 'is-open', selected.has(order.id) && 'is-selected')} onClick={() => setDrawer(order)}>
                      <td className="gm-ul__c-check" onClick={(event) => event.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(order.id)} disabled={!canSelect} onChange={() => toggle(order.id)} aria-label={t('№{n} ni tanlash', { n: order.orderNumber })} />
                      </td>
                      <td className="gm-ul__c-num">{(page - 1) * pageSize + index + 1}</td>
                      <td><strong className="gm-ord2__id">№{order.orderNumber}</strong></td>
                      <td>{person(order.customer, order.customer.phone)}</td>
                      <td>
                        {person(order.master.user, order.master.ratingAvg && Number(order.master.ratingAvg) > 0 ? `★ ${Number(order.master.ratingAvg).toFixed(1)}${order.master.ratingCount ? ` (${order.master.ratingCount})` : ''}${order.master.profession ? ` · ${order.master.profession}` : ''}` : (order.master.profession ?? order.master.user.phone))}
                      </td>
                      <td className="gm-ul__c-phone"><span className="gm-ord2__service">{order.category?.name ?? order.title}</span></td>
                      <td className="gm-ord2__amount">{formatMoney(order.finalAmount, order.currency)}</td>
                      <td><PaymentBadge payment={order.payment} /></td>
                      <td><OrderStatus status={order.status} /></td>
                      <td className="gm-ul__c-last"><span className="gm-ul__date">{formatDate(order.createdAt)}<small>{formatTime(order.createdAt)}</small></span></td>
                      <td className="gm-ul__c-act">{rowActions(order)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {items.length > 0 && view === 'grid' && (
          <div className="gm-adm2__grid">
            {items.map((order) => (
              <article key={order.id} className={cx('gm-adm2__card', drawer?.id === order.id && 'is-open')} onClick={() => setDrawer(order)}>
                <header>
                  <div>
                    <strong>№{order.orderNumber} · {order.category?.name ?? order.title}</strong>
                    <small>{formatDateTime(order.createdAt)}</small>
                  </div>
                  {rowActions(order)}
                </header>
                <div className="gm-adm2__badges"><OrderStatus status={order.status} /><PaymentBadge payment={order.payment} /></div>
                <div className="gm-ord2__pair">{person(order.customer, order.customer.phone)}{person(order.master.user, order.master.profession ?? order.master.user.phone)}</div>
                <footer><strong>{formatMoney(order.finalAmount, order.currency)}</strong><span>{formatRelativeTime(order.createdAt)}</span></footer>
              </article>
            ))}
          </div>
        )}

        {data && data.total > 0 && (
          <footer className="gm-ul__foot">
            <span>{t('Jami: {total} ta buyurtma, sahifa {page}/{pages}', { total: formatNumber(data.total), page: data.page, pages: formatNumber(data.pages) })}</span>
            <nav className="gm-ul__pager" aria-label={t('Sahifalar')}>
              <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label={t('Oldingi sahifa')}><ChevronLeft size={16} /></button>
              {pageNumbers(page, data.pages).map((entry) =>
                typeof entry === 'number' ? (
                  <button key={entry} type="button" className={cx(entry === page && 'is-on')} aria-current={entry === page ? 'page' : undefined} onClick={() => setPage(entry)}>{entry}</button>
                ) : (
                  <span key={entry}>…</span>
                ),
              )}
              <button type="button" onClick={() => setPage(page + 1)} disabled={page >= data.pages} aria-label={t('Keyingi sahifa')}><ChevronRight size={16} /></button>
              <select className="gm-adm2__size" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label={t('Sahifadagi soni')}>
                {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{t('{size} / sahifa', { size })}</option>)}
              </select>
            </nav>
          </footer>
        )}
      </section>

      {drawer && <OrderDrawer order={items.find((item) => item.id === drawer.id) ?? drawer} onClose={() => setDrawer(null)} />}
      {bulkCancel && (
        <BulkCancelDialog
          ids={[...selected]}
          onClose={() => setBulkCancel(false)}
          onDone={() => {
            setBulkCancel(false);
            setSelected(new Set());
            void queryClient.invalidateQueries({ queryKey: ['admin'] });
          }}
        />
      )}
    </div>
  );
}
