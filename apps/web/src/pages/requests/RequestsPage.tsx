import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Plus } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { getErrorMessage } from '@/lib/error-messages';
import { cx } from '@/lib/utils';
import { useMyRequests } from '@/features/request/hooks/useRequests';
import { RequestCard } from '@/features/request/components/RequestCard';
import type { RequestStatus } from '@/types/common';
import '@/features/order/components/Order.css';

type Tab = 'active' | 'booked' | 'closed';

const GROUPS: Record<Tab, readonly RequestStatus[]> = {
  active: ['DRAFT', 'SUBMITTED', 'MATCHING', 'OFFERS_RECEIVED'],
  booked: ['BOOKED'],
  closed: ['CANCELLED', 'EXPIRED'],
};
const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'active', label: 'Faol' },
  { value: 'booked', label: 'Band qilingan' },
  { value: 'closed', label: 'Yopilgan' },
];

export function RequestsPage() {
  const requests = useMyRequests();
  const [tab, setTab] = useState<Tab>('active');
  const items = useMemo(() => requests.data?.pages.flatMap((page) => page.items) ?? [], [requests.data]);
  const counts = { active: 0, booked: 0, closed: 0 };
  for (const item of items) for (const key of Object.keys(GROUPS) as Tab[]) if (GROUPS[key].includes(item.status)) counts[key] += 1;
  const visible = items.filter((item) => GROUPS[tab].includes(item.status));
  const empty = !requests.isLoading && items.length === 0;

  return (
    <div className="gm-opage">
      <div className="gm-page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>So‘rovlarim</h1>
          <p className="gm-page-lead">Yuborgan so‘rovlaringiz va ularga kelgan takliflar.</p>
        </div>
        {!empty && (
          <Link to="/mijozlar/sorov-yaratish">
            <Button size="sm">
              <Plus size={16} /> Yangi so‘rov
            </Button>
          </Link>
        )}
      </div>

      {requests.isError && <Alert tone="danger">{getErrorMessage(requests.error)}</Alert>}

      {requests.isLoading && (
        <div className="gm-request-list">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} style={{ height: 128, borderRadius: 16 }} />
          ))}
        </div>
      )}

      {empty && (
        <EmptyState
          icon={<ClipboardList size={28} />}
          title="Hali so‘rov yaratilmagan"
          description="Muammoingizni tasvirlab, birinchi so‘rovingizni yarating. Mos ustalar sizga narx bilan taklif yuboradi."
          action={
            <Link to="/mijozlar/sorov-yaratish">
              <Button>
                <Plus size={16} /> Yangi so‘rov yaratish
              </Button>
            </Link>
          }
        />
      )}

      {items.length > 0 && (
        <>
          <div className="gm-olist-tabs" role="tablist" aria-label="So‘rovlar">
            {TABS.map((item) => (
              <button key={item.value} type="button" role="tab" aria-selected={tab === item.value} className={cx('gm-otab', tab === item.value && 'gm-otab--active')} onClick={() => setTab(item.value)}>
                {item.label}
                <span className="gm-otab__count">{counts[item.value]}</span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyState icon={<ClipboardList size={28} />} title="Bu bo‘limda so‘rov yo‘q" description="Boshqa bo‘limni tanlang." />
          ) : (
            <div className="gm-request-list">
              {visible.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
          )}
          <Pagination hasMore={!!requests.hasNextPage} loading={requests.isFetchingNextPage} onLoadMore={() => void requests.fetchNextPage()} />
        </>
      )}
    </div>
  );
}
