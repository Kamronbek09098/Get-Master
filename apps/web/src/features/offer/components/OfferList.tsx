import { accountName } from '@/lib/account-name';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime, formatMoney, newIdempotencyKey } from '@/lib/utils';
import { useAcceptOffer, useRequestOffers } from '../hooks/useOffers';
import { OfferBadge } from './OfferBadge';

export function OfferList({ requestId }: { requestId: string }) {
  const offers = useRequestOffers(requestId);
  const accept = useAcceptOffer();
  const navigate = useNavigate();
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey());
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (offers.isLoading) return <PageLoader label="Takliflar yuklanmoqda…" />;
  if (offers.isError) return <Alert tone="danger">{getErrorMessage(offers.error)}</Alert>;
  const items = offers.data?.items ?? [];
  if (items.length === 0) {
    return <EmptyState title="Hozircha takliflar yo‘q" description="Ustalar taklif yuborganda shu yerda paydo bo‘ladi." />;
  }

  function handleAccept(offerId: string) {
    setPendingId(offerId);
    accept.mutate(
      { offerId, idempotencyKey },
      {
        onSuccess: (result) => navigate(`/mijozlar/buyurtmalar/${result.order.id}`),
        onSettled: () => {
          setPendingId(null);
          setIdempotencyKey(newIdempotencyKey());
        },
      },
    );
  }

  return (
    <div className="gm-list">
      {accept.isError && <Alert tone="danger">{getErrorMessage(accept.error)}</Alert>}
      {items.map((offer) => {
        const name = accountName(offer.master?.user);
        return (
          <div key={offer.id} className="gm-card">
            <div className="gm-card__header">
              <h3>
                {name} — {formatMoney(offer.price, offer.currency)}
              </h3>
              <OfferBadge status={offer.status} />
            </div>
            {offer.master && (
              <p className="gm-card__meta">
                Reyting: {Number(offer.master.ratingAvg).toFixed(1)} ({offer.master.ratingCount} ta sharh)
              </p>
            )}
            {offer.estimatedMinutes && <p>Taxminiy davomiylik: {offer.estimatedMinutes} daqiqa</p>}
            {offer.message && <p>{offer.message}</p>}
            <p className="gm-card__meta">Amal qilish muddati: {formatDateTime(offer.expiresAt)}</p>
            {offer.status === 'PENDING' && (
              <Button size="sm" loading={accept.isPending && pendingId === offer.id} onClick={() => handleAccept(offer.id)}>
                Qabul qilish
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
