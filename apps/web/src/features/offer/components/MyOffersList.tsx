import { CheckCircle2, Clock, FileText, Inbox, Send, Timer } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime, formatMinutes, formatMoney } from '@/lib/utils';
import { useMyOffers, useWithdrawOffer } from '../hooks/useOffers';
import { OfferBadge } from './OfferBadge';
import './MyOffersList.css';
import { t } from '@/i18n';

/** Usta yuborgan takliflar va ularning holati («Takliflar» sahifasidagi «Yuborgan takliflarim» ko‘rinishi). */
export function MyOffersList({ onBrowse }: { onBrowse: () => void }) {
  const offers = useMyOffers();
  const withdraw = useWithdrawOffer();

  if (offers.isLoading) return <PageLoader label={t('Takliflar yuklanmoqda…')} />;
  if (offers.isError) return <Alert tone="danger">{getErrorMessage(offers.error)}</Alert>;
  const items = offers.data?.items ?? [];

  return (
    <>
      {withdraw.isError && <Alert tone="danger">{getErrorMessage(withdraw.error)}</Alert>}
      {items.length === 0 && (
        <EmptyState
          icon={<FileText size={34} strokeWidth={1.8} />}
          title={t('Siz hali taklif yubormagansiz')}
          description={t('Mijozlar so‘rovlariga narx taklif qiling. Yuborgan takliflaringiz va ularning holati shu yerda ko‘rinadi.')}
          steps={[
            { icon: <Inbox size={16} aria-hidden="true" />, title: t('So‘rovni tanlang'), text: t('«Faol» bo‘limidan mos so‘rovni toping.') },
            { icon: <Send size={16} aria-hidden="true" />, title: t('Narx yuboring'), text: t('Narx va muddatni ko‘rsatib, taklif yuboring.') },
            { icon: <CheckCircle2 size={16} aria-hidden="true" />, title: t('Javobni kuting'), text: t('Mijoz qabul qilsa, buyurtma boshlanadi.') },
          ]}
          action={<Button onClick={onBrowse}>{t('So‘rovlarni ko‘rish')}</Button>}
        />
      )}
      <div className="gm-myoffers">
        {items.map((offer) => (
          <article key={offer.id} className={`gm-myoffer gm-myoffer--${offer.status.toLowerCase()}`}>
            <header className="gm-myoffer__head">
              <div className="gm-myoffer__title">
                <h3>{offer.request?.title ?? t('So‘rov')}</h3>
                {offer.request?.service && <span>{offer.request.service.name}</span>}
              </div>
              <OfferBadge status={offer.status} />
            </header>
            <div className="gm-myoffer__price">
              <strong>{formatMoney(offer.price, offer.currency)}</strong>
              {offer.estimatedMinutes ? (
                <span>
                  <Timer size={14} aria-hidden="true" /> {formatMinutes(offer.estimatedMinutes)}
                </span>
              ) : null}
            </div>
            {offer.message && <p className="gm-myoffer__message">{offer.message}</p>}
            <p className="gm-myoffer__meta">
              <span>
                <Send size={14} aria-hidden="true" /> {t('Yuborildi: {dateTime}', { dateTime: formatDateTime(offer.createdAt) })}
              </span>
              <span>
                <Clock size={14} aria-hidden="true" /> {t('Muddati: {dateTime}', { dateTime: formatDateTime(offer.expiresAt) })}
              </span>
            </p>
            {offer.status === 'PENDING' && (
              <Button size="md" variant="secondary" fullWidth loading={withdraw.isPending} onClick={() => withdraw.mutate(offer.id)}>
                {t('Qaytarib olish')}
              </Button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
