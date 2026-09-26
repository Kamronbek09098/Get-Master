import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ClipboardList, Plus, Search } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { MyOrderCard } from '@/features/order/components/MyOrderCard';
import type { MyOrderItem } from '@/features/order/components/MyOrderCard';
import { useMyOrders } from '@/features/order/hooks/useOrders';
import { useMyRequests } from '@/features/request/hooks/useRequests';
import type { RequestStatus } from '@/types/common';
import '@/features/order/components/Order.css';
import '@/features/order/components/MyOrders.css';

type Tab = 'active' | 'done' | 'closed';
const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'active', label: 'Faol' },
  { value: 'done', label: 'Yakunlangan' },
  { value: 'closed', label: 'Bekor qilingan' },
];
const OPEN_REQUEST: readonly RequestStatus[] = ['DRAFT', 'SUBMITTED', 'MATCHING', 'OFFERS_RECEIVED'];
const CLOSED_REQUEST: readonly RequestStatus[] = ['CANCELLED', 'EXPIRED'];

const createdAt = (item: MyOrderItem) => new Date(item.kind === 'request' ? item.request.createdAt : item.order.createdAt).getTime();

/**
 * Mijozning yagona «Buyurtmalar» bo‘limi: usta tanlanguncha — so‘rov (takliflar bilan),
 * tanlangach — buyurtma (ish jarayoni va to‘lov). Ikki alohida bo‘lim yo‘q.
 */
export function CustomerOrdersPage() {
  const orders = useMyOrders();
  const requests = useMyRequests();
  const [tab, setTab] = useState<Tab>('active');
  const [search, setSearch] = useState('');

  // Barcha so‘rovlarni birga ko‘rsatish uchun keyingi sahifalar avtomatik yuklanadi.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = requests;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const items = useMemo<MyOrderItem[]>(() => {
    const requestItems = (requests.data?.pages.flatMap((page) => page.items) ?? [])
      // Usta tanlangan so‘rovlar buyurtma sifatida ko‘rsatiladi, takrorlanmasin.
      .filter((request) => request.status !== 'BOOKED')
      .map((request): MyOrderItem => ({ kind: 'request', request }));
    const orderItems = (orders.data ?? []).map((order): MyOrderItem => ({ kind: 'order', order }));
    return [...requestItems, ...orderItems].sort((a, b) => createdAt(b) - createdAt(a));
  }, [requests.data, orders.data]);

  const needle = search.trim().toLowerCase();
  const matches = (item: MyOrderItem) => {
    if (!needle) return true;
    const text =
      item.kind === 'request'
        ? [item.request.title, item.request.description, item.request.service?.name]
        : [item.order.title, item.order.service?.name, accountName(item.order.counterpart), `№${item.order.orderNumber}`, String(item.order.orderNumber)];
    return text.filter(Boolean).join(' ').toLowerCase().includes(needle);
  };

  const groupOf = (item: MyOrderItem): Tab => {
    if (item.kind === 'request') return CLOSED_REQUEST.includes(item.request.status) ? 'closed' : 'active';
    if (item.order.status === 'COMPLETED') return 'done';
    if (item.order.status === 'CANCELLED' || item.order.status === 'EXPIRED') return 'closed';
    return 'active';
  };
  const grouped = useMemo(() => {
    const result: Record<Tab, MyOrderItem[]> = { active: [], done: [], closed: [] };
    for (const item of items) result[groupOf(item)].push(item);
    return result;
  }, [items]);

  // Mijozdan harakat kutilayotganlar: takliflar kelgan so‘rovlar va tasdiq kutayotgan buyurtmalar.
  const attention = useMemo(() => {
    let offers = 0;
    let confirm = 0;
    for (const item of grouped.active) {
      if (item.kind === 'request' && OPEN_REQUEST.includes(item.request.status) && (item.request.offersCount ?? 0) > 0) offers += 1;
      if (item.kind === 'order' && item.order.status === 'WAITING_CONFIRMATION') confirm += 1;
    }
    return { offers, confirm };
  }, [grouped.active]);

  const visible = grouped[tab].filter(matches);
  const loading = orders.isLoading || requests.isLoading;
  const empty = !loading && items.length === 0;

  return (
    <div className="gm-opage gm-mopage">
      <div className="gm-page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>Buyurtmalar</h1>
          <p className="gm-page-lead">Barcha so‘rov va buyurtmalaringiz bir joyda: takliflar, ish jarayoni va to‘lovlar.</p>
        </div>
        {!empty && (
          <Link to="/mijozlar/sorov-yaratish">
            <Button size="sm">
              <Plus size={16} /> Yangi buyurtma
            </Button>
          </Link>
        )}
      </div>

      {(orders.isError || requests.isError) && <Alert tone="danger">{getErrorMessage(orders.error ?? requests.error)}</Alert>}

      {(attention.offers > 0 || attention.confirm > 0) && (
        <div className="gm-mopage__attention" role="status">
          <AlertCircle size={18} aria-hidden="true" />
          <span>
            Sizdan harakat kutilmoqda:
            {attention.offers > 0 && ` ${attention.offers} ta so‘rovga takliflar keldi`}
            {attention.offers > 0 && attention.confirm > 0 && ','}
            {attention.confirm > 0 && ` ${attention.confirm} ta ish tasdig‘ingizni kutyapti`}
          </span>
        </div>
      )}

      {loading && (
        <div className="gm-mopage__list">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} style={{ height: 130, borderRadius: 16 }} />
          ))}
        </div>
      )}

      {empty && (
        <EmptyState
          icon={<ClipboardList size={28} />}
          title="Hali buyurtma yo‘q"
          description="Muammoingizni tasvirlab, birinchi buyurtmangizni yarating. Mos ustalar sizga narx bilan taklif yuboradi."
          action={
            <Link to="/mijozlar/sorov-yaratish">
              <Button>
                <Plus size={16} /> Yangi buyurtma yaratish
              </Button>
            </Link>
          }
        />
      )}

      {items.length > 0 && (
        <>
          <div className="gm-mopage__toolbar">
            <div className="gm-olist-tabs" role="tablist" aria-label="Buyurtmalar">
              {TABS.map((item) => (
                <button key={item.value} type="button" role="tab" aria-selected={tab === item.value} className={cx('gm-otab', tab === item.value && 'gm-otab--active')} onClick={() => setTab(item.value)}>
                  {item.label}
                  <span className="gm-otab__count">{grouped[item.value].length}</span>
                </button>
              ))}
            </div>
            <div className="gm-mopage__search">
              <Search size={16} aria-hidden="true" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nomi, xizmat, usta yoki № bo‘yicha qidirish" aria-label="Qidirish" />
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState icon={<ClipboardList size={28} />} title={needle ? 'Hech narsa topilmadi' : 'Bu bo‘limda buyurtma yo‘q'} description={needle ? 'Qidiruvni o‘zgartirib ko‘ring.' : 'Boshqa bo‘limni tanlang.'} />
          ) : (
            <div className="gm-mopage__list">
              {visible.map((item) => (
                <MyOrderCard key={item.kind === 'request' ? `r-${item.request.id}` : `o-${item.order.id}`} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
