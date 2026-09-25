import { useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { useMyOrders } from '@/features/order/hooks/useOrders';
import { OrderCard } from '@/features/order/components/OrderCard';
import { ACTIVE_STATUSES } from '@/features/order/order-flow';
import '@/features/order/components/Order.css';

type Tab = 'active' | 'done' | 'closed';

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'active', label: 'Faol' },
  { value: 'done', label: 'Yakunlangan' },
  { value: 'closed', label: 'Bekor qilingan' },
];

export function OrdersPage() {
  const orders = useMyOrders();
  const [tab, setTab] = useState<Tab>('active');

  const grouped = useMemo(() => {
    const items = orders.data ?? [];
    return {
      active: items.filter((order) => ACTIVE_STATUSES.includes(order.status)),
      done: items.filter((order) => order.status === 'COMPLETED'),
      closed: items.filter((order) => order.status === 'CANCELLED' || order.status === 'EXPIRED'),
    };
  }, [orders.data]);
  const visible = grouped[tab];

  return (
    <div className="gm-opage">
      <div className="gm-ohead">
        <div>
          <h1>Buyurtmalar</h1>
          <p>Qabul qilingan takliflar bo‘yicha ishlar shu yerda kuzatiladi.</p>
        </div>
      </div>

      <div className="gm-olist-tabs" role="tablist" aria-label="Buyurtmalar">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={cx('gm-otab', tab === item.value && 'gm-otab--active')}
            onClick={() => setTab(item.value)}
          >
            {item.label}
            <span className="gm-otab__count">
              {grouped[item.value].length}
            </span>
          </button>
        ))}
      </div>

      {orders.isError && <Alert tone="danger">{getErrorMessage(orders.error)}</Alert>}
      {orders.isLoading && (
        <div className="gm-olist">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} style={{ height: 160, borderRadius: 16 }} />
          ))}
        </div>
      )}
      {orders.data && visible.length === 0 && (
        <EmptyState
          icon={<ClipboardList size={28} />}
          title="Bu bo‘limda buyurtma yo‘q"
          description="Taklif qabul qilingach, buyurtma shu yerda ko‘rinadi."
        />
      )}
      {visible.length > 0 && (
        <div className="gm-olist">
          {visible.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
