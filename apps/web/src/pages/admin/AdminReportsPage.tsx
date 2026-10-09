import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, BarChart3, Banknote, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, CreditCard, Download, Eye, MoreVertical, RefreshCw, Search, Undo2, Wallet, X, XCircle } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { InfoTip } from '@/components/ui/InfoTip';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDateTime, formatMoney, newIdempotencyKey } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { providerLabel } from '@/features/payment/labels';
import { ProviderLogo } from '@/features/payment/components/ProviderLogo';
import { adminService } from '@/features/admin/services/admin.service';
import { useRefund, useReportPayments, useReportsOverview } from '@/features/admin/hooks/useAdmin';
import { AreaChart, Sparkline } from '@/features/admin/components/MiniChart';
import { DateRangeFilter } from '@/features/admin/components/DateRangeFilter';
import { toRange } from '@/features/admin/range';
import type { ReportPaymentRow, ReportTotals } from '@/features/admin/types';
import type { PaymentProvider, RefundReason } from '@/types/common';
import './AdminDashboardPage.css';
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

const PROVIDERS: Array<{ value: string; label: string }> = [
  { value: '', label: t('Barcha to‘lov turlari') },
  { value: 'CASH', label: t('Naqd pul') },
  { value: 'CLICK', label: t('Click') },
  { value: 'PAYME', label: t('Payme') },
  { value: 'UZUM', label: t('Uzum') },
  { value: 'OTHER', label: t('Boshqa usul') },
];

type StatusKey = 'succeeded' | 'pending' | 'refunded' | 'other';
const STATUS_FILTERS: Array<{ value: '' | StatusKey; label: string }> = [
  { value: '', label: t('Barcha holatlar') },
  { value: 'succeeded', label: t('Muvaffaqiyatli') },
  { value: 'pending', label: t('Kutilmoqda') },
  { value: 'refunded', label: t('Qaytarilgan') },
  { value: 'other', label: t('Bekor qilingan / xato') },
];

const STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | 'off' }> = {
  SUCCEEDED: { label: t('Muvaffaqiyatli'), tone: 'ok' },
  PENDING: { label: t('Kutilmoqda'), tone: 'warn' },
  PROCESSING: { label: t('Kutilmoqda'), tone: 'warn' },
  REFUNDED: { label: t('Qaytarilgan'), tone: 'bad' },
  PARTIALLY_REFUNDED: { label: t('Qisman qaytarilgan'), tone: 'bad' },
  FAILED: { label: t('Muvaffaqiyatsiz'), tone: 'off' },
  CANCELLED: { label: t('Bekor qilingan'), tone: 'off' },
};

const MONTHS_FULL = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
function rangeText(from: string, to: string, all: boolean): string {
  if (all) return t('Butun davr');
  const a = new Date(from);
  const b = new Date(to);
  if (a.toDateString() === b.toDateString()) return `${b.getDate()} ${MONTHS_FULL[b.getMonth()]}, ${b.getFullYear()}`;
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  return sameMonth ? `${a.getDate()} – ${b.getDate()} ${MONTHS_FULL[b.getMonth()]}, ${b.getFullYear()}` : `${a.getDate()} ${MONTHS_FULL[a.getMonth()]} – ${b.getDate()} ${MONTHS_FULL[b.getMonth()]}, ${b.getFullYear()}`;
}

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function Money({ value }: { value: number }) {
  return (
    <span className="gm-rmoney" title={`${nf.format(value)} UZS`}>
      {nf.format(Math.round(value))} <small>UZS</small>
    </span>
  );
}

/**
 * O‘tgan davrga nisbatan o‘zgarish. Oldingi davrda 0 bo‘lsa — foiz hisoblanmaydi («Yangi»): 0 dan o‘sishni «100%» deb ko‘rsatish chalg‘itadi.
 * `inverse` — ko‘paysa yomon (qaytarish, bekor qilish).
 */
function Delta({ now, before, inverse = false, format }: { now: number; before: number | null | undefined; inverse?: boolean; format: (value: number) => string }) {
  if (before == null) return <span className="gm-delta gm-delta--none">{t('Butun davr')}</span>;
  if (before === 0) {
    return now === 0 ? (
      <span className="gm-delta gm-delta--none">{t('O‘zgarishsiz')} <small>({t('oldingi davr')}: 0)</small></span>
    ) : (
      <span className="gm-delta"><b className={cx('gm-delta__v', inverse ? 'is-bad' : 'is-good')}>{t('Yangi')}</b><small>({t('oldingi davr')}: 0)</small></span>
    );
  }
  const change = ((now - before) / before) * 100;
  const flat = Math.abs(change) < 0.05;
  const up = change > 0;
  const good = inverse ? !up : up;
  return (
    <span className="gm-delta" title={`${t('Oldingi davr')}: ${format(before)}`}>
      <b className={cx('gm-delta__v', flat ? 'is-flat' : good ? 'is-good' : 'is-bad')}>
        {flat ? '' : up ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}
        {Math.abs(change) >= 1000 ? '>999' : Math.abs(change).toFixed(1)}%
      </b>
      <small>({t('oldingi davr')}: {format(before)})</small>
    </span>
  );
}

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

function Skeleton({ className }: { className?: string }) {
  return <span className={cx('gm-skeleton', className)} aria-hidden="true" />;
}

/**
 * To‘lovni qaytarish oynasi. Xavfsizlik: Idempotency-Key oyna ochilganda BIR marta yaratiladi (qayta bosish yoki tarmoq xatosidan keyin
 * qayta urinish ikki marta qaytarmaydi), summa ≤ qolgan summa, sabab va izoh majburiy, tasdiqlash belgisi talab qilinadi.
 */
function RefundDialog({ payment, onClose }: { payment: ReportPaymentRow; onClose: () => void }) {
  const refund = useRefund();
  const key = useRef(newIdempotencyKey());
  const max = Number(payment.amount) - Number(payment.refundedAmount);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<RefundReason>('CUSTOMER_REQUEST');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const value = Number(amount);
  const invalid = amount === '' ? null : !Number.isFinite(value) || value <= 0 ? t('Summa 0 dan katta bo‘lishi kerak.') : value > max ? t('Summa qolgan {max} dan oshmasligi kerak.', { max: formatMoney(max, payment.currency) }) : null;
  const ready = amount !== '' && !invalid && note.trim().length >= 3 && confirm && !refund.isPending && !refund.isSuccess;
  const quick = (share: number) => setAmount(String(Math.max(1, Math.floor(max * share))));

  return (
    <Modal
      open
      onClose={refund.isPending ? () => undefined : onClose}
      title={t('To‘lovni qaytarish')}
      footer={
        refund.isSuccess ? (
          <Button onClick={onClose}>{t('Yopish')}</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={refund.isPending}>{t('Bekor qilish')}</Button>
            <Button
              loading={refund.isPending}
              disabled={!ready}
              onClick={() => refund.mutate({ id: payment.id, amount: value, reason, note: note.trim(), idempotencyKey: key.current })}
            >
              {t('Qaytarish')} {amount && !invalid ? formatMoney(value, payment.currency) : ''}
            </Button>
          </>
        )
      }
    >
      {refund.isSuccess ? (
        <Alert tone="success" title={t('Qaytarish amalga oshirildi')}>
          {t('{amount} mijozga qaytarildi. Jadval yangilandi.', { amount: formatMoney(value, payment.currency) })}
        </Alert>
      ) : (
        <div className="gm-form gm-refund">
          <dl className="gm-refund__sum">
            <div><dt>{t('Mijoz')}</dt><dd>{accountName(payment.customer)}</dd></div>
            <div><dt>{t('To‘lov turi')}</dt><dd>{providerLabel(payment.provider)}</dd></div>
            <div><dt>{t('To‘lov summasi')}</dt><dd>{formatMoney(payment.amount, payment.currency)}</dd></div>
            <div><dt>{t('Avval qaytarilgan')}</dt><dd>{formatMoney(payment.refundedAmount, payment.currency)}</dd></div>
            <div className="is-strong"><dt>{t('Qaytarish mumkin')}</dt><dd>{formatMoney(max, payment.currency)}</dd></div>
          </dl>
          {refund.isError && <Alert tone="danger">{getErrorMessage(refund.error)} {t('Qayta urinsangiz, takroriy qaytarish yaratilmaydi.')}</Alert>}
          <Input label={t('Qaytariladigan summa')} type="number" inputMode="numeric" min={1} max={max} step="1" value={amount} error={invalid ?? undefined} onChange={(e) => setAmount(e.target.value)} autoFocus />
          <div className="gm-refund__quick" role="group" aria-label={t('Tez tanlash')}>
            <button type="button" onClick={() => quick(0.25)}>25%</button>
            <button type="button" onClick={() => quick(0.5)}>50%</button>
            <button type="button" onClick={() => setAmount(String(max))}>{t('To‘liq')}</button>
          </div>
          <Select label={t('Sabab')} options={REASONS} value={reason} onChange={(e) => setReason(e.target.value as RefundReason)} />
          <Input label={t('Izoh (majburiy)')} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} hint={t('Audit jurnaliga yoziladi.')} />
          <label className="gm-refund__confirm">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
            <span>{t('Qaytarishni bekor qilib bo‘lmasligini tushunaman.')}</span>
          </label>
        </div>
      )}
    </Modal>
  );
}

export function AdminReportsPage() {
  const [range, setRange] = useState(() => {
    const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    return { from: iso(new Date(Date.now() - 29 * 86_400_000)), to: iso(new Date()) };
  });
  const apiRange = toRange(range);
  const overview = useReportsOverview(apiRange);
  const [tab, setTab] = useState<'revenue' | 'payments' | 'refunds'>('revenue');
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('');
  const [status, setStatus] = useState<'' | StatusKey>('');
  const [byPeriod, setByPeriod] = useState(true);
  const [sort, setSort] = useState<{ key: 'createdAt' | 'amount' | 'status'; dir: 'asc' | 'desc' }>({ key: 'createdAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search.trim(), 350);
  const filters = { ...(byPeriod ? apiRange : {}), search: debounced || undefined, provider: provider || undefined, status: status || undefined, sort: sort.key, dir: sort.dir };
  const payments = useReportPayments({ ...filters, page, limit: 10 });
  const [refundFor, setRefundFor] = useState<ReportPaymentRow | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const tableRef = useRef<HTMLElement>(null);

  const data = overview.data;
  const cur = data?.current;
  const prev = data?.previous;
  const series = useMemo(() => data?.series ?? [], [data]);
  const net = (x: ReportTotals) => x.revenue - x.refunded;
  const hasFilters = !!(debounced || provider || status);

  function goTable(next: Partial<{ status: '' | StatusKey; search: string }>) {
    if (next.status !== undefined) setStatus(next.status);
    if (next.search !== undefined) setSearch(next.search);
    setPage(1);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toggleSort(key: 'createdAt' | 'amount' | 'status') {
    setSort((current) => (current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'status' ? 'asc' : 'desc' }));
    setPage(1);
  }

  /** Joriy filtrlarga mos BARCHA to‘lovlarni CSV (Excel ochadi) qilib yuklaydi. */
  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const rows: ReportPaymentRow[] = [];
      for (let p = 1; p <= 40; p += 1) {
        const batch = await adminService.reportPayments({ ...filters, page: p, limit: 50 });
        rows.push(...batch.items);
        if (p >= batch.pages) break;
      }
      const head = ['ID', t('Sana'), t('Mijoz'), t('Telefon'), t('To‘lov turi'), t('Summa'), t('Qaytarilgan'), t('Valyuta'), t('Holat')];
      const lines = rows.map((row) => [row.id, formatDateTime(row.createdAt), accountName(row.customer), row.customer.phone, providerLabel(row.provider), row.amount, row.refundedAmount, row.currency, STATUS[row.status]?.label ?? row.status].map(csvCell).join(','));
      const blob = new Blob([`﻿${[head.map(csvCell).join(','), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hisobot-${range.from || 'barchasi'}_${range.to || ''}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  const periodHint = prev ? t('Oldingi shunday davr bilan solishtirildi') : t('Butun davr uchun solishtirish yo‘q');
  const cards: Array<{ key: string; label: string; icon: ReactNode; tone: string; value: number; before?: number; inverse?: boolean; spark: number[]; color: string; tip: string; note?: ReactNode }> = cur
    ? [
        { key: 'rev', label: t('Jami tushum'), icon: <Wallet size={22} />, tone: 'green', value: cur.revenue, before: prev?.revenue, spark: series.map((p) => p.revenue), color: '#10b981', tip: t('Muvaffaqiyatli to‘lovlar summasi (to‘lov bajarilgan kun bo‘yicha). {hint}.', { hint: periodHint }) },
        { key: 'ref', label: t('Qaytarilgan'), icon: <Undo2 size={22} />, tone: 'red', value: cur.refunded, before: prev?.refunded, inverse: true, spark: series.map((p) => p.refunded), color: '#e5384f', tip: t('Qaytarishlar jurnalidagi muvaffaqiyatli qaytarishlar (qaytarilgan kun bo‘yicha).') },
        { key: 'net', label: t('Sof tushum'), icon: <Banknote size={22} />, tone: 'blue', value: net(cur), before: prev ? net(prev) : undefined, spark: series.map((p) => p.revenue - p.refunded), color: '#2f6bff', tip: t('Jami tushum − qaytarilgan.') },
        {
          key: 'pro', label: t('Platforma daromadi'), icon: <BarChart3 size={22} />, tone: 'violet', value: cur.platformFee, before: prev?.platformFee, spark: [], color: '#8b5cf6',
          tip: t('Yakunlangan buyurtmalarda saqlangan haqiqiy komissiya ({rate}%). Taxminiy hisob emas.', { rate: ((data?.commissionRate ?? 0.05) * 100).toFixed(0) }),
          note: cur.completedWithoutFee > 0 ? <span className="gm-rkpi__warn"><AlertTriangle size={12} aria-hidden="true" /> {t('{n} ta buyurtmada komissiya saqlanmagan', { n: cur.completedWithoutFee })}</span> : undefined,
        },
      ]
    : [];

  const small = cur
    ? [
        { label: t('To‘lovlar'), icon: <CreditCard size={20} />, tone: 'blue', value: cur.payments, before: prev?.payments, hint: t('shundan {n} ta muvaffaqiyatli', { n: cur.settledPayments }), onClick: () => goTable({ status: '' }) },
        { label: t('Buyurtmalar'), icon: <ClipboardList size={20} />, tone: 'blue', value: cur.orders, before: prev?.orders, to: '/admin/buyurtmalar' },
        { label: t('Yakunlangan'), icon: <CheckCircle2 size={20} />, tone: 'blue', value: cur.completed, before: prev?.completed, to: '/admin/buyurtmalar' },
        { label: t('Bekor qilingan'), icon: <XCircle size={20} />, tone: 'red', value: cur.cancelled, before: prev?.cancelled, inverse: true, to: '/admin/buyurtmalar' },
      ]
    : [];

  const chartPoints = series.map((p) => ({ date: p.date, value: tab === 'revenue' ? p.revenue : tab === 'payments' ? p.payments : p.refunded }));
  const ps = data?.paymentStatus;
  const otherCount = ps ? ps.failed + ps.cancelled : 0;
  const psTotal = ps ? ps.succeeded + ps.pending + ps.refunded + otherCount : 0;
  const statusRows: Array<{ key: StatusKey; label: string; count: number; tone: string; icon: ReactNode }> = ps
    ? [
        { key: 'succeeded', label: t('Muvaffaqiyatli'), count: ps.succeeded, tone: 'ok', icon: <CheckCircle2 size={14} /> },
        { key: 'pending', label: t('Kutilmoqda'), count: ps.pending, tone: 'warn', icon: <CalendarDays size={14} /> },
        { key: 'refunded', label: t('Qaytarilgan'), count: ps.refunded, tone: 'bad', icon: <Undo2 size={14} /> },
        { key: 'other', label: t('Bekor qilingan / xato'), count: otherCount, tone: 'off', icon: <XCircle size={14} /> },
      ]
    : [];
  const maxStatus = Math.max(1, ...statusRows.map((r) => r.count));
  const items = payments.data?.items ?? [];
  const pages = payments.data?.pages ?? 1;
  const pageList = useMemo(() => {
    const list: Array<number | '…'> = [];
    for (let n = 1; n <= pages; n += 1) if (n === 1 || n === pages || Math.abs(n - page) <= 1) list.push(n);
    return list.flatMap((n, i) => (i > 0 && typeof n === 'number' && typeof list[i - 1] === 'number' && n - (list[i - 1] as number) > 1 ? (['…', n] as Array<number | '…'>) : [n]));
  }, [pages, page]);
  const sortIcon = (key: string) => (sort.key !== key ? <ArrowUpDown size={13} aria-hidden="true" /> : sort.dir === 'asc' ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />);

  return (
    <div className="gm-dash gm-rep">
      <div className="gm-rep__top">
        <div>
          <nav className="gm-dash-crumbs" aria-label={t('Joylashuv')}>
            <span>{t('Boshqaruv')}</span> <ChevronRight size={12} aria-hidden="true" /> <span>{t('Hisobotlar')}</span>
          </nav>
          <h1>{t('Hisobotlar')}</h1>
          <p className="gm-page-lead">{t('Daromad, to‘lovlar va platforma faoliyati')}</p>
        </div>
        <div className="gm-rep__tools">
          <span className="gm-rep__period" title={t('Hisobot davri (Toshkent vaqti)')}><CalendarDays size={17} aria-hidden="true" /> {data ? rangeText(data.range.from, data.range.to, data.range.all) : '…'}</span>
          <Button variant="secondary" onClick={() => { void overview.refetch(); void payments.refetch(); }} loading={(overview.isFetching || payments.isFetching) && !overview.isLoading}>
            <RefreshCw size={16} /> {t('Yangilash')}
          </Button>
          <Button onClick={() => void exportCsv()} loading={exporting} disabled={!payments.data || payments.data.total === 0}>
            <Download size={16} /> {t('Eksport')}
          </Button>
        </div>
      </div>

      <DateRangeFilter value={range} onChange={(next) => { setRange(next); setPage(1); }} withAll={false} showCalendarIcon={false} />

      {exportError && <Alert tone="danger">{t('Eksport bajarilmadi')}: {exportError}</Alert>}
      {overview.isError && (
        <Alert tone="danger" title={t('Hisobotni yuklab bo‘lmadi')}>
          {getErrorMessage(overview.error)} <Button size="sm" variant="secondary" onClick={() => void overview.refetch()}>{t('Qayta urinish')}</Button>
        </Alert>
      )}
      {data && data.reconciliation.mismatchCount > 0 && (
        <Alert tone="warning" title={t('Moliyaviy tafovut aniqlandi')}>
          <p style={{ margin: 0 }}>{t('{n} ta to‘lovda yozilgan qaytarilgan summa qaytarishlar jurnali bilan mos kelmaydi. Hisobotdagi «Qaytarilgan» summa jurnalga asoslangan.', { n: data.reconciliation.mismatchCount })}</p>
          <ul className="gm-recon">
            {data.reconciliation.items.map((item) => (
              <li key={item.paymentId}>
                <button type="button" onClick={() => goTable({ search: item.paymentId })}>#{item.paymentId.slice(0, 8).toUpperCase()}</button>
                <span>{t('to‘lovda')}: {formatMoney(item.recorded)} · {t('jurnalda')}: {formatMoney(item.ledger)} · <b>{t('farq')}: {formatMoney(item.difference)}</b></span>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {overview.isLoading && (
        <>
          <div className="gm-rkpis">{[0, 1, 2, 3].map((i) => <div key={i} className="gm-rkpi"><Skeleton className="gm-skeleton--circle" /><div className="gm-rkpi__body"><Skeleton className="gm-skeleton--line" /><Skeleton className="gm-skeleton--big" /><Skeleton className="gm-skeleton--line" /></div></div>)}</div>
          <div className="gm-dpanel"><Skeleton className="gm-skeleton--chart" /></div>
        </>
      )}

      {data && cur && (
        <div className={cx('gm-rep__body', overview.isFetching && 'is-busy')} aria-busy={overview.isFetching}>
          <div className="gm-rkpis">
            {cards.map((card) => (
              <div key={card.key} className="gm-rkpi">
                <span className={`gm-rkpi__icon gm-rkpi__icon--${card.tone}`} aria-hidden="true">{card.icon}</span>
                <div className="gm-rkpi__body">
                  <span className="gm-rkpi__label">{card.label} <InfoTip text={card.tip} label={card.label} /></span>
                  <strong><Money value={card.value} /></strong>
                  <Delta now={card.value} before={card.before} inverse={card.inverse} format={(v) => `${nf.format(Math.round(v))} UZS`} />
                  {card.note}
                </div>
                {card.spark.length > 0 && <Sparkline values={card.spark} color={card.color} />}
              </div>
            ))}
          </div>

          <div className="gm-rsmall">
            {small.map((card) => {
              const body = (
                <>
                  <span className={`gm-rkpi__icon gm-rkpi__icon--${card.tone}`} aria-hidden="true">{card.icon}</span>
                  <div className="gm-rkpi__body">
                    <span className="gm-rkpi__label">{card.label}</span>
                    <strong className="gm-rsmall__n">{nf.format(card.value)}</strong>
                    {'hint' in card && card.hint && <span className="gm-rsmall__hint">{card.hint}</span>}
                    <Delta now={card.value} before={card.before} inverse={card.inverse} format={(v) => nf.format(v)} />
                  </div>
                  <ChevronRight size={16} aria-hidden="true" className="gm-rsmall__go" />
                </>
              );
              return 'to' in card && card.to ? (
                <Link key={card.label} to={card.to} className="gm-rsmall__card">{body}</Link>
              ) : (
                <button key={card.label} type="button" className="gm-rsmall__card" onClick={card.onClick}>{body}</button>
              );
            })}
          </div>

          <div className="gm-dgrid gm-dgrid--chart">
            <section className="gm-dpanel">
              <header className="gm-dpanel__head">
                <h2>{t('Tushum dinamikasi')} <InfoTip text={t('Kunlik qiymatlar Toshkent vaqti bo‘yicha. Chiziqlar haqiqiy kunlik natijalarni to‘g‘ridan-to‘g‘ri bog‘laydi.')} label={t('Tushum dinamikasi')} /></h2>
                <div className="gm-seg" role="tablist" aria-label={t('Ko‘rsatkich')}>
                  {([['revenue', t('Tushum')], ['payments', t('To‘lovlar')], ['refunds', t('Qaytarishlar')]] as const).map(([id, label]) => (
                    <button key={id} type="button" role="tab" aria-selected={tab === id} className={cx(tab === id && 'is-on')} onClick={() => setTab(id)}>{label}</button>
                  ))}
                </div>
              </header>
              <AreaChart points={chartPoints} unit={t('Tushum dinamikasi')} integer={tab === 'payments'} format={tab === 'payments' ? (v) => `${nf.format(v)} ${t('ta')}` : (v) => `${nf.format(v)} UZS`} />
            </section>

            <section className="gm-dpanel">
              <header className="gm-dpanel__head">
                <h2>{t('To‘lovlar holati')} <InfoTip text={t('Davrda yaratilgan to‘lovlar holati bo‘yicha. Qatorni bossangiz, jadval shu holat bilan filtrlanadi.')} label={t('To‘lovlar holati')} /></h2>
              </header>
              {psTotal === 0 ? (
                <div className="gm-dpanel__empty">{t('Bu davrda to‘lovlar yo‘q')}</div>
              ) : (
                <ul className="gm-ostat gm-pstat">
                  {statusRows.map((row) => (
                    <li key={row.key} className={`gm-ostat__row gm-ostat__row--${row.tone}`}>
                      <button type="button" className="gm-pstat__btn" onClick={() => goTable({ status: row.key })} aria-label={`${row.label}: ${row.count}`}>
                        <span className="gm-pstat__ico" aria-hidden="true">{row.icon}</span>
                        <span className="gm-pstat__name">{row.label}</span>
                        <b>{row.count} <small>({Math.round((row.count / psTotal) * 100)}%)</small></b>
                      </button>
                      <div className="gm-ostat__bar" aria-hidden="true"><span style={{ width: `${row.count ? Math.max(4, (row.count / maxStatus) * 100) : 0}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      <section className="gm-dpanel gm-ptable" id="tolovlar" ref={tableRef}>
        <header className="gm-dpanel__head gm-ptable__head">
          <h2>{t('So‘nggi to‘lovlar')}</h2>
          <label className="gm-ptable__search">
            <Search size={16} aria-hidden="true" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('ID, №, mijoz yoki summa')} title={t('ID, buyurtma №, mijoz yoki summa…')} aria-label={t('Qidirish')} />
            {search && <button type="button" onClick={() => { setSearch(''); setPage(1); }} aria-label={t('Tozalash')}><X size={14} aria-hidden="true" /></button>}
          </label>
          <select className="gm-ptable__select" value={status} onChange={(e) => { setStatus(e.target.value as '' | StatusKey); setPage(1); }} aria-label={t('Holat')}>
            {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="gm-ptable__select" value={provider} onChange={(e) => { setProvider(e.target.value); setPage(1); }} aria-label={t('To‘lov turi')}>
            {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button type="button" className={cx('gm-ptable__cal', byPeriod && 'is-on')} aria-pressed={byPeriod} title={byPeriod ? t('Tanlangan davr bo‘yicha (o‘chirish uchun bosing)') : t('Barcha davr (davr bo‘yicha filtrlash uchun bosing)')} onClick={() => { setByPeriod((v) => !v); setPage(1); }}>
            <CalendarDays size={18} aria-hidden="true" />
          </button>
          {hasFilters && <button type="button" className="gm-ptable__reset" onClick={() => { setSearch(''); setProvider(''); setStatus(''); setPage(1); }}>{t('Filtrlarni tozalash')}</button>}
        </header>

        {payments.isError && (
          <Alert tone="danger" title={t('To‘lovlarni yuklab bo‘lmadi')}>
            {getErrorMessage(payments.error)} <Button size="sm" variant="secondary" onClick={() => void payments.refetch()}>{t('Qayta urinish')}</Button>
          </Alert>
        )}

        {payments.isLoading ? (
          <div className="gm-ptbl" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="gm-ptbl__skel"><Skeleton className="gm-skeleton--line" /></div>)}</div>
        ) : payments.data && items.length === 0 ? (
          <EmptyState
            title={hasFilters ? t('Filtrga mos to‘lov topilmadi') : t('Bu davrda to‘lovlar yo‘q')}
            description={hasFilters ? t('Qidiruv yoki filtrlarni o‘zgartirib ko‘ring.') : t('Boshqa davrni tanlang.')}
            action={hasFilters ? <Button variant="secondary" onClick={() => { setSearch(''); setProvider(''); setStatus(''); setPage(1); }}>{t('Filtrlarni tozalash')}</Button> : undefined}
          />
        ) : (
          <div className={cx('gm-ptbl', payments.isFetching && 'is-busy')} role="table" aria-busy={payments.isFetching}>
            <div className="gm-ptbl__row gm-ptbl__row--head" role="row">
              <span>ID</span>
              <button type="button" className="gm-ptbl__sort" onClick={() => toggleSort('createdAt')} aria-label={`${t('Sana bo‘yicha saralash')}`}>{t('Sana')} {sortIcon('createdAt')}</button>
              <span>{t('Mijoz')}</span>
              <span>{t('To‘lov turi')}</span>
              <button type="button" className="gm-ptbl__sort" onClick={() => toggleSort('amount')} aria-label={t('Summa bo‘yicha saralash')}>{t('Summa')} {sortIcon('amount')}</button>
              <button type="button" className="gm-ptbl__sort" onClick={() => toggleSort('status')} aria-label={t('Holat bo‘yicha saralash')}>{t('Holat')} {sortIcon('status')}</button>
              <span>{t('Amallar')}</span><span aria-hidden="true" />
            </div>
            {items.map((row) => {
              const state = STATUS[row.status] ?? { label: row.status, tone: 'off' as const };
              const refundable = Number(row.amount) - Number(row.refundedAmount);
              const canRefund = (row.status === 'SUCCEEDED' || row.status === 'PARTIALLY_REFUNDED') && refundable > 0;
              return (
                <div key={row.id} className="gm-ptbl__row" role="row">
                  <span className="gm-ptbl__id" data-label="ID" title={row.id}>#{row.id.slice(0, 8).toUpperCase()}<small>№{row.order.orderNumber}</small></span>
                  <span className="gm-ptbl__date" data-label={t('Sana')}>{formatDateTime(row.createdAt)}</span>
                  <span className="gm-ptbl__who" data-label={t('Mijoz')}>
                    <em aria-hidden="true">{accountName(row.customer).charAt(0)}</em>
                    <span><b title={accountName(row.customer)}>{accountName(row.customer)}</b><small>{row.customer.phone}</small></span>
                  </span>
                  <span className="gm-ptbl__prov" data-label={t('To‘lov turi')}><ProviderLogo provider={row.provider as PaymentProvider} size={26} /><b>{providerLabel(row.provider)}</b></span>
                  <span className="gm-ptbl__sum" data-label={t('Summa')}>
                    {formatMoney(row.amount, row.currency)}
                    {Number(row.refundedAmount) > 0 && <small title={t('Qaytarilgan')}>−{formatMoney(row.refundedAmount, row.currency)}</small>}
                  </span>
                  <span data-label={t('Holat')}><span className={`gm-pill gm-pill--${state.tone}`}><i aria-hidden="true" />{state.label}</span></span>
                  <span className="gm-ptbl__act">
                    <Link to={`/admin/buyurtmalar/${row.orderId}`} className="gm-ptbl__btn"><Eye size={14} aria-hidden="true" /> {t('Ko‘rish')}</Link>
                    {canRefund && <button type="button" className="gm-ptbl__btn gm-ptbl__btn--primary" onClick={() => setRefundFor(row)}>{t('Qaytarish')}</button>}
                  </span>
                  <span className="gm-ptbl__more">
                    <button type="button" aria-label={t('Boshqa amallar')} aria-expanded={menu === row.id} onClick={() => setMenu(menu === row.id ? null : row.id)}><MoreVertical size={16} aria-hidden="true" /></button>
                    {menu === row.id && (
                      <div className="gm-ptbl__menu" onMouseLeave={() => setMenu(null)}>
                        <Link to={`/admin/buyurtmalar/${row.orderId}`}>{t('Buyurtmani ochish')} (№{row.order.orderNumber})</Link>
                        <Link to={`/admin/foydalanuvchilar/${row.customer.id}`}>{t('Mijozni ochish')}</Link>
                        <button type="button" onClick={() => { void navigator.clipboard?.writeText(row.id); setMenu(null); }}>{t('To‘lov ID sini nusxalash')}</button>
                      </div>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {payments.data && payments.data.total > 0 && (
          <footer className="gm-ptable__foot">
            <span>
              {t('Jami {n} ta to‘lov', { n: payments.data.total })} {byPeriod && <small>({t('tanlangan davr bo‘yicha')})</small>}
              {payments.data.filteredSettled.amount > 0 && (
                <small className="gm-ptable__sums"> · {t('Muvaffaqiyatli')}: {formatMoney(payments.data.filteredSettled.amount)}{payments.data.filteredSettled.refunded > 0 ? ` · ${t('qaytarilgan')}: ${formatMoney(payments.data.filteredSettled.refunded)}` : ''}</small>
              )}
            </span>
            {pages > 1 && (
              <div className="gm-pager" role="navigation" aria-label={t('Sahifalar')}>
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label={t('Oldingi')}><ChevronLeft size={16} aria-hidden="true" /></button>
                {pageList.map((n, i) => (n === '…' ? <span key={`gap${i}`} className="gm-pager__gap">…</span> : <button key={n} type="button" className={cx(n === page && 'is-on')} aria-current={n === page ? 'page' : undefined} onClick={() => setPage(n)}>{n}</button>))}
                <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label={t('Keyingi')}><ChevronRight size={16} aria-hidden="true" /></button>
              </div>
            )}
          </footer>
        )}
      </section>

      {refundFor && <RefundDialog key={refundFor.id} payment={refundFor} onClose={() => setRefundFor(null)} />}
    </div>
  );
}
