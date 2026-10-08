import { useState } from 'react';
import { CalendarClock, Send, UserCheck } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/utils';
import { useIncomingRequests } from '@/features/offer/hooks/useOffers';
import { PausedNotice, usePaused } from '@/features/master/components/PausedNotice';
import { OfferBadge } from '@/features/offer/components/OfferBadge';
import { OfferForm } from '@/features/offer/components/OfferForm';
import { t } from '@/i18n';

export function CreateOfferPage() {
  const incoming = useIncomingRequests();
  const [openId, setOpenId] = useState<string | null>(null);
  const paused = usePaused();

  if (incoming.isLoading) return <PageLoader label={t('So‘rovlar yuklanmoqda…')} />;
  if (incoming.isError) return <Alert tone="danger">{getErrorMessage(incoming.error)}</Alert>;
  const items = incoming.data?.items ?? [];

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>{t('Sizga kelgan so‘rovlar')}</h1>
          <p className="gm-page-lead">{t('Sizga moslangan yangi so‘rovlar shu yerda ko‘rinadi.')}</p>
        </div>
      </div>
      {paused && <PausedNotice />}
      {items.length === 0 && (
        <EmptyState
          icon={<Send size={34} strokeWidth={1.8} />}
          steps={[
            { icon: <UserCheck size={16} aria-hidden="true" />, title: t('Profil tasdiqlangan'), text: t('Hujjatlaringiz admin tomonidan tasdiqlangan bo‘lsin.') },
            { icon: <CalendarClock size={16} aria-hidden="true" />, title: t('Ish jadvali to‘ldirilgan'), text: t('Mijozlar band qila oladigan ish vaqtlarini kiriting.') },
            { icon: <Send size={16} aria-hidden="true" />, title: t('So‘rovlar keladi'), text: t('Mos so‘rovlar avtomatik shu yerda ko‘rinadi.') },
          ]}
          title={t('Hozircha yangi so‘rovlar yo‘q')}
          description={t('Profilingiz faol, tasdiqlangan va ish jadvalingiz to‘ldirilgan bo‘lsa, mos so‘rovlar shu yerda ko‘rinadi.')}
        />
      )}
      <div className="gm-list">
        {items.map(({ id, request }) => {
          const myOffer = request.offers[0];
          return (
            <div key={id} className="gm-card">
              <div className="gm-card__header">
                <h3>{request.title}</h3>
                {myOffer && <OfferBadge status={myOffer.status} />}
              </div>
              <p>{request.description}</p>
              <p className="gm-card__meta">{t('Yaratildi: {dateTime}', { dateTime: formatDateTime(request.createdAt) })}{request.preferredStartAt && t(' · Xohlangan vaqt: {dateTime}', { dateTime: formatDateTime(request.preferredStartAt) })}
              </p>
              {!myOffer && openId !== request.id && (
                <Button size="sm" disabled={paused} onClick={() => setOpenId(request.id)}>{t('Taklif berish')}</Button>
              )}
              {!myOffer && !paused && openId === request.id && (
                <OfferForm requestId={request.id} onDone={() => setOpenId(null)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
