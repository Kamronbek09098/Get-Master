import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime, formatMoney } from '@/lib/utils';
import { useMyOffers, useWithdrawOffer } from '@/features/offer/hooks/useOffers';
import { OfferBadge } from '@/features/offer/components/OfferBadge';

export function MyOffersPage() {
  const offers = useMyOffers();
  const withdraw = useWithdrawOffer();

  if (offers.isLoading) return <PageLoader label="Takliflar yuklanmoqda…" />;
  if (offers.isError) return <Alert tone="danger">{getErrorMessage(offers.error)}</Alert>;
  const items = offers.data?.items ?? [];

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>Takliflarim</h1>
          <p className="gm-page-lead">Siz yuborgan takliflar va ularning holati.</p>
        </div>
      </div>
      {withdraw.isError && <Alert tone="danger">{getErrorMessage(withdraw.error)}</Alert>}
      {items.length === 0 && <EmptyState title="Siz hali taklif yubormagansiz" />}
      <div className="gm-list">
        {items.map((offer) => (
          <div key={offer.id} className="gm-card">
            <div className="gm-card__header">
              <h3>{formatMoney(offer.price, offer.currency)}</h3>
              <OfferBadge status={offer.status} />
            </div>
            {offer.message && <p>{offer.message}</p>}
            <p className="gm-card__meta">
              Yuborildi: {formatDateTime(offer.createdAt)} · Muddati: {formatDateTime(offer.expiresAt)}
            </p>
            {offer.status === 'PENDING' && (
              <Button size="sm" variant="secondary" loading={withdraw.isPending} onClick={() => withdraw.mutate(offer.id)}>
                Qaytarib olish
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
