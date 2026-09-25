import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { STATUS_TEXT } from '@/features/order/order-flow';
import { useAdminOrders, useAdminOrdersSummary } from '@/features/admin/hooks/useAdmin';
import type { AdminOrderFilters, AdminOrderStatus } from '@/features/admin/types';
import './AdminOrdersPage.css';

const TABS: Array<{ value: AdminOrderStatus | ''; label: string }> = [
  { value: '', label: 'Hammasi' },
  { value: 'BOOKED', label: 'Band qilingan' },
  { value: 'CONFIRMED', label: 'Tasdiqlangan' },
  { value: 'ON_THE_WAY', label: 'Yo‘lda' },
  { value: 'IN_PROGRESS', label: 'Jarayonda' },
  { value: 'WAITING_CONFIRMATION', label: 'Tasdiq kutilmoqda' },
  { value: 'COMPLETED', label: 'Yakunlangan' },
  { value: 'CANCELLED', label: 'Bekor qilingan' },
  { value: 'DISPUTED', label: 'Nizoli' },
];
const dayStart = (value: string) => (value ? new Date(`${value}T00:00:00`).toISOString() : undefined);
const dayEnd = (value: string) => (value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined);

export function AdminOrdersPage() {
  const [status, setStatus] = useState<AdminOrderStatus | ''>('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [flagged, setFlagged] = useState(false);
  const debounced = useDebounce(search, 400);

  const filters: AdminOrderFilters = { status: status || undefined, search: debounced.trim() || undefined, from: dayStart(from), to: dayEnd(to), flagged: flagged ? 'true' : undefined };
  const orders = useAdminOrders(filters);
  const summary = useAdminOrdersSummary();
  const items = useMemo(() => orders.data?.pages.flatMap((page) => page.items) ?? [], [orders.data]);
  const counts = summary.data?.counts ?? {};
  const active = !!(status || search || from || to || flagged);

  return (
    <div className="gm-aord">
      <div className="gm-page-header">
        <div>
          <h1>Buyurtmalar</h1>
          <p className="gm-page-lead">Platformadagi barcha buyurtmalar: holati, tomonlar, to‘lovlar va usta yuklagan rasmlar. Kerak bo‘lsa, boshqarish mumkin.</p>
        </div>
      </div>

      {summary.data && (
        <section className="gm-aord__stats" aria-label="Umumiy ko‘rsatkichlar">
          <div className="gm-aord__stat">
            <ClipboardList size={18} />
            <strong>{summary.data.total}</strong>
            <small>Jami buyurtma</small>
          </div>
          <div className="gm-aord__stat">
            <ArrowRight size={18} />
            <strong>{summary.data.active}</strong>
            <small>Jarayonda</small>
          </div>
          <button type="button" className={cx('gm-aord__stat gm-aord__stat--warn', flagged && 'gm-aord__stat--on')} onClick={() => setFlagged((value) => !value)} aria-pressed={flagged}>
            <AlertTriangle size={18} />
            <strong>{summary.data.flagged}</strong>
            <small>Nizoli / shikoyatli</small>
          </button>
          <div className="gm-aord__stat">
            <CheckCircle2 size={18} />
            <strong>{counts.COMPLETED ?? 0}</strong>
            <small>Yakunlangan</small>
          </div>
          <div className="gm-aord__stat">
            <Wallet size={18} />
            <strong>{formatMoney(summary.data.completedAmount)}</strong>
            <small>Yakunlanganlar summasi</small>
          </div>
        </section>
      )}

      <section className="gm-aord__filters" aria-label="Filtrlar">
        <div className="gm-aord__search">
          <Search size={16} aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buyurtma ID, mijoz yoki usta ismi/telefoni, so‘rov nomi" aria-label="Qidirish" />
        </div>
        <div className="gm-aord__tabs" role="group" aria-label="Holat">
          {TABS.map((tab) => (
            <button key={tab.value} type="button" aria-pressed={status === tab.value} className={cx('gm-otab', status === tab.value && 'gm-otab--active')} onClick={() => setStatus(tab.value)}>
              {tab.label}
              {tab.value && (counts[tab.value] ?? 0) > 0 && <span className="gm-aord__count">{counts[tab.value]}</span>}
            </button>
          ))}
        </div>
        <div className="gm-aord__dates">
          <label>
            <span>Sanadan</span>
            <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            <span>Sanagacha</span>
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
              }}
            >
              <X size={14} /> Tozalash
            </Button>
          )}
        </div>
      </section>

      {orders.isLoading && <PageLoader />}
      {orders.isError && <Alert tone="danger">{getErrorMessage(orders.error)}</Alert>}
      {orders.data && items.length === 0 && <EmptyState title="Buyurtma topilmadi" description={active ? 'Filtrlarni o‘zgartirib ko‘ring.' : undefined} />}

      <ul className="gm-aord__list">
        {items.map((order) => (
          <li key={order.id}>
            <Link to={`/admin/buyurtmalar/${order.id}`} className={cx('gm-aord__row', order.status === 'DISPUTED' && 'gm-aord__row--disputed')}>
              <div className="gm-aord__main">
                <div className="gm-aord__title">
                  <strong>{order.title}</strong>
                  <OrderStatus status={order.status} />
                </div>
                <p>
                  {accountName(order.customer)} <small>ID {order.customer.accountNumber}</small> <ArrowRight size={12} aria-hidden="true" /> {accountName(order.master.user)} <small>ID {order.master.user.accountNumber}</small>
                  {order.master.profession && <small> · {order.master.profession}</small>}
                </p>
                <div className="gm-aord__meta">
                  <span>#{order.id.slice(0, 8)}</span>
                  <span title={formatDateTime(order.createdAt)}>{formatRelativeTime(order.createdAt)}</span>
                  {order.scheduledStartAt && <span>Reja: {formatDateTime(order.scheduledStartAt)}</span>}
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
                <small>{STATUS_TEXT[order.status]}</small>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {orders.hasNextPage && (
        <div className="gm-aord__more">
          <Button variant="secondary" loading={orders.isFetchingNextPage} onClick={() => void orders.fetchNextPage()}>
            Ko‘proq yuklash
          </Button>
        </div>
      )}
    </div>
  );
}
