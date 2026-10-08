import { Link } from 'react-router-dom';
import { CheckCircle2, FileText, Inbox, Send } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime, formatMoney } from '@/lib/utils';
import { useMyOffers, useWithdrawOffer } from '@/features/offer/hooks/useOffers';
import { OfferBadge } from '@/features/offer/components/OfferBadge';
import { t } from '@/i18n';

export function MyOffersPage() {
  const offers = useMyOffers();
  const withdraw = useWithdrawOffer();

  if (offers.isLoading) return <PageLoader label={t('Takliflar yuklanmoqda…')} />;
  if (offers.isError) return <Alert tone="danger">{getErrorMessage(offers.error)}</Alert>;
  const items = offers.data?.items ?? [];

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>{t('Takliflarim')}</h1>
          <p className="gm-page-lead">{t('Siz yuborgan takliflar va ularning holati')}</p>
        </div>
      </div>
      {withdraw.isError && <Alert tone="danger">{getErrorMessage(withdraw.error)}</Alert>}
      {items.length === 0 && (
        <EmptyState
          icon={<FileText size={34} strokeWidth={1.8} />}
          title={t('Siz hali taklif yubormagansiz')}
          description={t('Mijozlar so‘rovlariga narx taklif qiling. Yuborgan takliflaringiz va ularning holati shu yerda ko‘rinadi.')}
          steps={[
            { icon: <Inbox size={16} aria-hidden="true" />, title: t('So‘rovni tanlang'), text: t('«Faol takliflar» bo‘limidan mos so‘rovni toping.') },
            { icon: <Send size={16} aria-hidden="true" />, title: t('Narx yuboring'), text: t('Narx va muddatni ko‘rsatib, taklif yuboring.') },
            { icon: <CheckCircle2 size={16} aria-hidden="true" />, title: t('Javobni kuting'), text: t('Mijoz qabul qilsa, buyurtma boshlanadi.') },
          ]}
          action={
            <Link to="/usta/faol-takliflar">
              <Button>{t('Faol takliflarni ko‘rish')}</Button>
            </Link>
          }
        />
      )}
      <div className="gm-list">
        {items.map((offer) => (
          <div key={offer.id} className="gm-card">
            <div className="gm-card__header">
              <h3>{formatMoney(offer.price, offer.currency)}</h3>
              <OfferBadge status={offer.status} />
            </div>
            {offer.message && <p>{offer.message}</p>}
            <p className="gm-card__meta">{t('Yuborildi: {dateTime} · Muddati: {dateTime2}', { dateTime: formatDateTime(offer.createdAt), dateTime2: formatDateTime(offer.expiresAt) })}</p>
            {offer.status === 'PENDING' && (
              <Button size="sm" variant="secondary" loading={withdraw.isPending} onClick={() => withdraw.mutate(offer.id)}>{t('Qaytarib olish')}</Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
