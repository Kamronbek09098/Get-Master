import { useState } from 'react';
import { CalendarClock, Send, UserCheck } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/utils';
import { useIncomingRequests } from '@/features/offer/hooks/useOffers';
import { OfferBadge } from '@/features/offer/components/OfferBadge';
import { OfferForm } from '@/features/offer/components/OfferForm';

export function CreateOfferPage() {
  const incoming = useIncomingRequests();
  const [openId, setOpenId] = useState<string | null>(null);

  if (incoming.isLoading) return <PageLoader label="So‘rovlar yuklanmoqda…" />;
  if (incoming.isError) return <Alert tone="danger">{getErrorMessage(incoming.error)}</Alert>;
  const items = incoming.data?.items ?? [];

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>Sizga kelgan so‘rovlar</h1>
          <p className="gm-page-lead">Sizga moslangan yangi so‘rovlar shu yerda ko‘rinadi.</p>
        </div>
      </div>
      {items.length === 0 && (
        <EmptyState
          icon={<Send size={34} strokeWidth={1.8} />}
          steps={[
            { icon: <UserCheck size={16} aria-hidden="true" />, title: 'Profil tasdiqlangan', text: 'Hujjatlaringiz admin tomonidan tasdiqlangan bo‘lsin.' },
            { icon: <CalendarClock size={16} aria-hidden="true" />, title: 'Ish jadvali to‘ldirilgan', text: 'Mijozlar band qila oladigan ish vaqtlarini kiriting.' },
            { icon: <Send size={16} aria-hidden="true" />, title: 'So‘rovlar keladi', text: 'Mos so‘rovlar avtomatik shu yerda ko‘rinadi.' },
          ]}
          title="Hozircha yangi so‘rovlar yo‘q"
          description="Profilingiz faol, tasdiqlangan va ish jadvalingiz to‘ldirilgan bo‘lsa, mos so‘rovlar shu yerda ko‘rinadi."
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
              <p className="gm-card__meta">
                Yaratildi: {formatDateTime(request.createdAt)}
                {request.preferredStartAt && ` · Xohlangan vaqt: ${formatDateTime(request.preferredStartAt)}`}
              </p>
              {!myOffer && openId !== request.id && (
                <Button size="sm" onClick={() => setOpenId(request.id)}>
                  Taklif berish
                </Button>
              )}
              {!myOffer && openId === request.id && (
                <OfferForm requestId={request.id} onDone={() => setOpenId(null)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
