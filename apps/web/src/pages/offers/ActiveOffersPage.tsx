import { useState } from 'react';
import { CalendarClock, CheckCircle2, Timer, Users } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { formatCountdown, formatDateTime, formatMoney, formatRelativeTime } from '@/lib/utils';
import { useCountdown } from '@/hooks/useCountdown';
import { AcceptRequestDialog } from '@/features/offer/components/AcceptRequestDialog';
import { OfferBadge } from '@/features/offer/components/OfferBadge';
import { useOpenRequests } from '@/features/offer/hooks/useOffers';
import type { OpenRequest, OpenRequestScope } from '@/features/offer/types';

const TABS: Array<{ value: OpenRequestScope; label: string }> = [
  { value: 'all', label: 'Barcha faol' },
  { value: 'mine', label: 'Menga mos' },
];

function ExpiryCountdown({ expiresAt }: { expiresAt: string | null }) {
  const remaining = useCountdown(expiresAt);
  if (remaining === null) return null;
  const expired = remaining <= 0;
  const soon = !expired && remaining < 60 * 60_000;
  return (
    <Badge tone={expired ? 'danger' : soon ? 'warning' : 'neutral'}>
      <Timer size={14} /> {formatCountdown(remaining)}
    </Badge>
  );
}

export function ActiveOffersPage() {
  const [scope, setScope] = useState<OpenRequestScope>('all');
  const [selected, setSelected] = useState<OpenRequest | null>(null);
  const requests = useOpenRequests(scope);
  const items = requests.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div>
      <div className="gm-page-header">
        <h1>Faol takliflar</h1>
      </div>
      <p className="gm-card__meta" style={{ marginBottom: 'var(--gm-space-4)', maxWidth: 640 }}>
        Mijozlar yuborgan va hozir ustalarni kutayotgan so‘rovlar. Yoqqanini «Qabul qilish» bilan oling — narxingiz mijozga
        taklif sifatida boradi.
      </p>

      <div className="gm-tabs" role="tablist" aria-label="Ko‘rinish">
        {TABS.map((tab) => (
          <Button
            key={tab.value}
            size="sm"
            role="tab"
            aria-selected={scope === tab.value}
            variant={scope === tab.value ? 'primary' : 'secondary'}
            onClick={() => setScope(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {requests.isLoading && <PageLoader label="Takliflar yuklanmoqda…" />}
      {requests.isError && <Alert tone="danger">{getErrorMessage(requests.error)}</Alert>}
      {requests.data && items.length === 0 && (
        <EmptyState
          title="Hozircha faol takliflar yo‘q"
          description={
            scope === 'mine'
              ? '«Barcha faol» bo‘limida boshqa xizmatlar bo‘yicha so‘rovlarni ham ko‘rishingiz mumkin.'
              : 'Yangi so‘rov kelganda shu yerda paydo bo‘ladi.'
          }
        />
      )}

      <div className="gm-list">
        {items.map((request) => (
          <div key={request.id} className="gm-card">
            <div className="gm-card__header">
              <h3>{request.title}</h3>
              <div className="gm-action-row">
                {request.notified && <Badge tone="primary">Sizga yuborilgan</Badge>}
                {request.service && <Badge tone="neutral">{request.service.name}</Badge>}
                {request.expiresAt && <ExpiryCountdown expiresAt={request.expiresAt} />}
              </div>
            </div>
            <p className="gm-request-card__description">{request.description}</p>
            <p className="gm-card__meta gm-offer-meta">
              <span>
                <Users size={14} /> Takliflar: {request.offersCount}
              </span>
              <span>
                <CalendarClock size={14} /> {formatRelativeTime(request.createdAt)}
              </span>
              {request.preferredStartAt && <span>Xohlangan vaqt: {formatDateTime(request.preferredStartAt)}</span>}
              {request.expiresAt && <span>Taklif muddati: {formatDateTime(request.expiresAt)}</span>}
            </p>

            <div className="gm-action-row" style={{ marginTop: 'var(--gm-space-3)' }}>
              {request.myOffer ? (
                <>
                  <OfferBadge status={request.myOffer.status} />
                  <span className="gm-card__meta" style={{ margin: 0 }}>
                    Sizning taklifingiz: {formatMoney(request.myOffer.price)}
                  </span>
                </>
              ) : (
                <Button size="sm" onClick={() => setSelected(request)}>
                  <CheckCircle2 size={16} /> Qabul qilish
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {requests.hasNextPage && (
        <div style={{ marginTop: 'var(--gm-space-4)', textAlign: 'center' }}>
          <Button variant="secondary" loading={requests.isFetchingNextPage} onClick={() => void requests.fetchNextPage()}>
            Yana yuklash
          </Button>
        </div>
      )}

      {selected && <AcceptRequestDialog request={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
