import { accountName } from '@/lib/account-name';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, Clock3, Hourglass, MessageSquareText, Star, UserRound } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDateTime, formatMinutes, formatMoney, formatRelativeTime, newIdempotencyKey } from '@/lib/utils';
import { useAcceptOffer, useRequestOffers } from '../hooks/useOffers';
import type { Offer } from '../types';
import { OfferBadge } from './OfferBadge';
import { t } from '@/i18n';
import './OfferList.css';

/** Taklif muddatigacha qolgan vaqt: «3 soat 20 daq» (o‘tib ketgan bo‘lsa — null). */
function timeLeft(expiresAt: string): string | null {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return formatMinutes(Math.max(1, Math.round(ms / 60_000)));
}

export function OfferList({ requestId }: { requestId: string }) {
  const offers = useRequestOffers(requestId);
  const accept = useAcceptOffer();
  const navigate = useNavigate();
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey());
  const [confirming, setConfirming] = useState<Offer | null>(null);

  if (offers.isLoading) return <PageLoader label={t('Takliflar yuklanmoqda…')} />;
  if (offers.isError) return <Alert tone="danger">{getErrorMessage(offers.error)}</Alert>;
  const items = offers.data?.items ?? [];
  if (items.length === 0) {
    return <EmptyState title={t('Hozircha takliflar yo‘q')} description={t('Ustalar taklif yuborganda shu yerda paydo bo‘ladi.')} />;
  }
  // Eng arzon taklif belgilanadi (kamida 2 ta kutilayotgan taklif bo‘lsa).
  const pending = items.filter((offer) => offer.status === 'PENDING');
  const cheapest = pending.length > 1 ? Math.min(...pending.map((offer) => Number(offer.price))) : null;

  function confirmAccept() {
    if (!confirming) return;
    accept.mutate(
      { offerId: confirming.id, idempotencyKey },
      {
        onSuccess: (result) => {
          setConfirming(null);
          navigate(`/mijoz/buyurtmalar/${result.order.id}`);
        },
        onSettled: () => setIdempotencyKey(newIdempotencyKey()),
      },
    );
  }

  return (
    <div className="gm-offers">
      {accept.isError && !confirming && <Alert tone="danger">{getErrorMessage(accept.error)}</Alert>}
      {items.map((offer) => {
        const name = accountName(offer.master?.user);
        const left = offer.status === 'PENDING' ? timeLeft(offer.expiresAt) : null;
        const expired = offer.status === 'PENDING' && !left;
        const reviews = offer.master?.ratingCount ?? 0;
        const profile = offer.master?.user.accountNumber != null ? `/mijoz/ustalar/${offer.master.user.accountNumber}` : null;
        return (
          <article key={offer.id} className={cx('gm-ofr', offer.status !== 'PENDING' && 'is-closed')} aria-label={`${name}: ${formatMoney(offer.price, offer.currency)}`}>
            <header className="gm-ofr__head">
              <ChatAvatar name={name} seed={offer.master?.id ?? offer.id} size="lg" src={offer.master?.user.avatar} />
              <div className="gm-ofr__who">
                <h3>{name}</h3>
                <span className="gm-ofr__rating">
                  {reviews > 0 ? (
                    <>
                      <Star size={14} fill="currentColor" aria-hidden="true" /> <b>{Number(offer.master?.ratingAvg ?? 0).toFixed(1)}</b> <small>({t('{ratingCount} ta sharh', { ratingCount: reviews })})</small>
                    </>
                  ) : (
                    <small>{t('Yangi usta — hali sharh yo‘q')}</small>
                  )}
                </span>
              </div>
              <OfferBadge status={expired ? 'EXPIRED' : offer.status} />
            </header>

            <div className="gm-ofr__pricebox">
              <div>
                <small>{t('Taklif narxi')}</small>
                <strong>{formatMoney(offer.price, offer.currency)}</strong>
              </div>
              {cheapest != null && offer.status === 'PENDING' && Number(offer.price) === cheapest && <span className="gm-ofr__tag">{t('Eng arzon')}</span>}
            </div>

            <dl className="gm-ofr__facts">
              <div>
                <dt><Clock3 size={14} aria-hidden="true" /> {t('Davomiyligi')}</dt>
                <dd>{offer.estimatedMinutes ? formatMinutes(offer.estimatedMinutes) : t('Kelishiladi')}</dd>
              </div>
              <div>
                <dt><CalendarClock size={14} aria-hidden="true" /> {t('Kela oladi')}</dt>
                <dd>{offer.availableAt ? formatDateTime(offer.availableAt) : t('Kelishilgan vaqtda')}</dd>
              </div>
              <div className={cx(expired && 'is-bad')}>
                <dt><Hourglass size={14} aria-hidden="true" /> {t('Taklif muddati')}</dt>
                <dd title={formatDateTime(offer.expiresAt)}>{offer.status !== 'PENDING' ? formatRelativeTime(offer.createdAt) : left ? t('{left} qoldi', { left }) : t('Muddati tugagan')}</dd>
              </div>
            </dl>

            {offer.message && (
              <blockquote className="gm-ofr__msg">
                <MessageSquareText size={16} aria-hidden="true" />
                <p>{offer.message}</p>
              </blockquote>
            )}

            <footer className="gm-ofr__foot">
              {profile && (
                <Link to={profile} className="gm-ofr__profile">
                  <UserRound size={16} aria-hidden="true" /> {t('Usta profili')}
                </Link>
              )}
              {offer.status === 'PENDING' && !expired && (
                <Button onClick={() => setConfirming(offer)} loading={accept.isPending && confirming?.id === offer.id}>
                  {t('Qabul qilish')}
                </Button>
              )}
            </footer>
          </article>
        );
      })}

      <ConfirmDialog
        open={!!confirming}
        title={t('Taklifni qabul qilasizmi?')}
        description={confirming ? t('{name} bilan {price} narxda buyurtma yaratiladi. Qolgan takliflar rad etiladi.', { name: accountName(confirming.master?.user), price: formatMoney(confirming.price, confirming.currency) }) : ''}
        confirmLabel={t('Ha, qabul qilaman')}
        cancelLabel={t('Bekor qilish')}
        showCancel
        loading={accept.isPending}
        onConfirm={confirmAccept}
        onCancel={() => {
          setConfirming(null);
          accept.reset();
        }}
      >
        {accept.isError && <Alert tone="danger">{getErrorMessage(accept.error)}</Alert>}
      </ConfirmDialog>
    </div>
  );
}
