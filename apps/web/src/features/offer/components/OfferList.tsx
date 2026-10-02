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
import { t } from '@/i18n';

export function OfferList({ requestId }: { requestId: string }) {
  const offers = useRequestOffers(requestId);
  const accept = useAcceptOffer();
  const navigate = useNavigate();
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey());
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (offers.isLoading) return <PageLoader label={t('Takliflar yuklanmoqda…')} />;
  if (offers.isError) return <Alert tone="danger">{getErrorMessage(offers.error)}</Alert>;
  const items = offers.data?.items ?? [];
  if (items.length === 0) {
    return <EmptyState title={t('Hozircha takliflar yo‘q')} description={t('Ustalar taklif yuborganda shu yerda paydo bo‘ladi.')} />;
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
          <article key={offer.id} className="gm-card gm-offer">
            <div className="gm-offer__main">
              <div className="gm-offer__who">
                <h3>{name}</h3>
                {offer.master && (
                  <span className="gm-offer__rating">
                    ★ {Number(offer.master.ratingAvg).toFixed(1)} <small>{t('({ratingCount} ta sharh)', { ratingCount: offer.master.ratingCount })}</small>
                  </span>
                )}
              </div>
              <OfferBadge status={offer.status} />
            </div>
            <div className="gm-offer__price">{formatMoney(offer.price, offer.currency)}</div>
            {(offer.estimatedMinutes || offer.message) && (
              <div className="gm-offer__details">
                {offer.estimatedMinutes && <p>{t('Taxminiy davomiylik:')}{' '}<strong>{offer.estimatedMinutes} daqiqa</strong></p>}
                {offer.message && <p>{offer.message}</p>}
              </div>
            )}
            <div className="gm-offer__foot">
              <span className="gm-card__meta">{t('Amal qilish muddati:')}{' '}{formatDateTime(offer.expiresAt)}</span>
              {offer.status === 'PENDING' && (
                <Button size="sm" loading={accept.isPending && pendingId === offer.id} onClick={() => handleAccept(offer.id)}>{t('Qabul qilish')}</Button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
