import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Camera, CheckCircle2, ClipboardList, Search, Wallet, X } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { useDebounce } from '@/hooks/useDebounce';
import { cx, formatDateTime, formatMoney, formatRelativeTime } from '@/lib/utils';
import { OrderStatus } from '@/features/order/components/OrderStatus';
import { useAdminOrders, useAdminOrdersSummary } from '@/features/admin/hooks/useAdmin';
import type { AdminOrderFilters, AdminOrderStatus } from '@/features/admin/types';
import { PAYMENT_STATUS_LABEL, providerLabel } from '@/features/payment/labels';
import './AdminOrdersPage.css';
import { t } from '@/i18n';

const TABS: Array<{ value: AdminOrderStatus | ''; label: string }> = [
  { value: '', label: t('Hammasi') },
  { value: 'BOOKED', label: t('Band qilingan') },
  { value: 'CONFIRMED', label: t('Tasdiqlangan') },
  { value: 'ON_THE_WAY', label: t('Yo‘lda') },
  { value: 'IN_PROGRESS', label: t('Jarayonda') },
  { value: 'WAITING_CONFIRMATION', label: t('Tasdiq kutilmoqda') },
  { value: 'COMPLETED', label: t('Yakunlangan') },
  { value: 'CANCELLED', label: t('Bekor qilingan') },
  { value: 'DISPUTED', label: t('Nizoli') },
];
const STATUS_TONE: Partial<Record<AdminOrderStatus, string>> = {
  BOOKED: 'info',
  CONFIRMED: 'info',
  ON_THE_WAY: 'info',
  IN_PROGRESS: 'info',
  WAITING_CONFIRMATION: 'wait',
  COMPLETED: 'ok',
  CANCELLED: 'off',
  DISPUTED: 'bad',
};
const dayStart = (value: string) => (value ? new Date(`${value}T00:00:00`).toISOString() : undefined);
const dayEnd = (value: string) => (value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined);

export function AdminOrdersPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<AdminOrderStatus | ''>('');
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [ongoing, setOngoing] = useState(false);
  const debounced = useDebounce(search, 400);

  /** Yuqoridagi statistik kartochkalar bir-birini istisno qiladi: biri tanlanganda qolganlari tozalanadi. */
  function selectView(next: { status?: AdminOrderStatus | ''; flagged?: boolean; ongoing?: boolean }) {
    setStatus(next.status ?? '');
    setFlagged(next.flagged ?? false);
    setOngoing(next.ongoing ?? false);
  }

  const filters: AdminOrderFilters = {
    status: status || undefined,
    search: debounced.trim() || undefined,
    from: dayStart(from),
    to: dayEnd(to),
    flagged: flagged ? 'true' : undefined,
    ongoing: ongoing ? 'true' : undefined,
  };
  const orders = useAdminOrders(filters);
  const summary = useAdminOrdersSummary();
  const items = useMemo(() => orders.data?.pages.flatMap((page) => page.items) ?? [], [orders.data]);
  const counts = summary.data?.counts ?? {};
  const active = !!(status || search || from || to || flagged || ongoing);

  return (
    <div className="gm-aord">
      <div className="gm-page-header">
        <div>
          <h1>{t('Buyurtmalar')}</h1>
          <p className="gm-page-lead">{t('Platformadagi barcha buyurtmalar: holati, tomonlar, to‘lovlar va usta yuklagan rasmlar. Kerak bo‘lsa, boshqarish mumkin.')}</p>
        </div>
      </div>

      {summary.data && (
        <section className="gm-aord__stats" aria-label={t('Umumiy ko‘rsatkichlar')}>
          <button
            type="button"
            className={cx('gm-aord__stat', !status && !flagged && !ongoing && 'gm-aord__stat--on')}
            onClick={() => selectView({})}
            aria-pressed={!status && !flagged && !ongoing}
          >
            <ClipboardList size={18} />
            <strong>{summary.data.total}</strong>
            <small>{t('Jami buyurtma')}</small>
          </button>
          <button type="button" className={cx('gm-aord__stat', ongoing && 'gm-aord__stat--on')} onClick={() => selectView({ ongoing: true })} aria-pressed={ongoing}>
            <ArrowRight size={18} />
            <strong>{summary.data.active}</strong>
            <small>{t('Jarayonda')}</small>
          </button>
          <button type="button" className={cx('gm-aord__stat gm-aord__stat--warn', flagged && 'gm-aord__stat--on')} onClick={() => selectView({ flagged: true })} aria-pressed={flagged}>
            <AlertTriangle size={18} />
            <strong>{summary.data.flagged}</strong>
            <small>{t('Nizoli / shikoyatli')}</small>
          </button>
          <button
            type="button"
            className={cx('gm-aord__stat', status === 'COMPLETED' && 'gm-aord__stat--on')}
            onClick={() => selectView({ status: 'COMPLETED' })}
            aria-pressed={status === 'COMPLETED'}
          >
            <CheckCircle2 size={18} />
            <strong>{counts.COMPLETED ?? 0}</strong>
            <small>{t('Yakunlangan')}</small>
          </button>
          <button
            type="button"
            className={cx('gm-aord__stat', status === 'COMPLETED' && 'gm-aord__stat--on')}
            onClick={() => selectView({ status: 'COMPLETED' })}
            aria-pressed={status === 'COMPLETED'}
          >
            <Wallet size={18} />
            <strong>{formatMoney(summary.data.completedAmount)}</strong>
            <small>{t('Yakunlanganlar summasi')}</small>
          </button>
        </section>
      )}

      <section className="gm-aord__filters" aria-label={t('Filtrlar')}>
        <div className="gm-aord__search">
          <Search size={16} aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Buyurtma №, mijoz yoki usta')} title={t('Buyurtma raqami (№), mijoz yoki usta ID/ismi/telefoni, so‘rov nomi')} aria-label={t('Qidirish')} />
        </div>
        <div className="gm-aord__tabs" role="group" aria-label={t('Holat')}>
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={status === tab.value}
              className={cx('gm-otab', status === tab.value && 'gm-otab--active')}
              onClick={() => selectView({ status: tab.value })}
            >
              {tab.label}
              {(tab.value ? (counts[tab.value] ?? 0) : (summary.data?.total ?? 0)) > 0 && <span className="gm-aord__count">{tab.value ? counts[tab.value] : summary.data?.total}</span>}
            </button>
          ))}
        </div>
        <div className="gm-aord__dates">
          <label>
            <span>{t('Sanadan')}</span>
            <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            <span>{t('Sanagacha')}</span>
            <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
          </label>
          {active && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setStatus('');
                setSearch('');
                setFrom('');
                setTo('');
                setFlagged(false);
                setOngoing(false);
              }}
            >
              <X size={14} />{' '}{t('Tozalash')}</Button>
          )}
        </div>
      </section>

      {orders.isLoading && <PageLoader />}
      {orders.isError && <Alert tone="danger">{getErrorMessage(orders.error)}</Alert>}
      {orders.data && items.length === 0 && <EmptyState title={t('Buyurtma topilmadi')} description={active ? t('Filtrlarni o‘zgartirib ko‘ring.') : undefined} />}

      <ul className="gm-aord__list">
        {items.map((order) => (
          <li key={order.id}>
            <Link to={`/admin/buyurtmalar/${order.id}`} className={cx('gm-aord__row', `gm-aord__row--${STATUS_TONE[order.status] ?? 'info'}`)}>
              <div className="gm-aord__main">
                <div className="gm-aord__title">
                  <strong>{order.title}</strong>
                  <OrderStatus status={order.status} />
                </div>
                <p className="gm-aord__who">
                  <span>
                    <em>{t('Mijoz')}</em> {accountName(order.customer)} <small>ID {order.customer.accountNumber}</small>
                  </span>
                  <ArrowRight size={14} aria-hidden="true" />
                  <span>
                    <em>{t('Usta')}</em> {accountName(order.master.user)} <small>ID {order.master.user.accountNumber}</small>
                    {order.master.profession && <small> · {order.master.profession}</small>}
                  </span>
                </p>
                <div className="gm-aord__meta">
                  <span>№{order.orderNumber}</span>
                  <span title={formatDateTime(order.createdAt)}>{formatRelativeTime(order.createdAt)}</span>
                  {order.scheduledStartAt && <span>{t('Reja:')}{' '}{formatDateTime(order.scheduledStartAt)}</span>}
                  <span className={cx('gm-aord__chip', order.payment?.status === 'SUCCEEDED' ? 'gm-aord__chip--paid' : 'gm-aord__chip--muted')}>
                    <Wallet size={12} />{' '}
                    {order.payment
                      ? `${providerLabel(order.payment.provider)} · ${PAYMENT_STATUS_LABEL[order.payment.status]}`
                      : t('To‘lov usuli tanlanmagan')}
                  </span>
                  {order._count.workProofs > 0 && (
                    <span className="gm-aord__chip">
                      <Camera size={12} /> {order._count.workProofs} rasm
                    </span>
                  )}
                  {order._count.cases > 0 && (
                    <span className="gm-aord__chip gm-aord__chip--warn">
                      <AlertTriangle size={12} /> {order._count.cases} shikoyat/nizo
                    </span>
                  )}
                </div>
              </div>
              <div className="gm-aord__amount">
                <strong>{formatMoney(order.finalAmount, order.currency)}</strong>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {orders.hasNextPage && (
        <div className="gm-aord__more">
          <Button variant="secondary" loading={orders.isFetchingNextPage} onClick={() => void orders.fetchNextPage()}>{t('Ko‘proq yuklash')}</Button>
        </div>
      )}
    </div>
  );
}
