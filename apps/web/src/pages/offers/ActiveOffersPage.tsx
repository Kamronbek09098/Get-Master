import { useState } from 'react';
import { CalendarClock, CheckCircle2, Inbox, Send, Timer, Users } from 'lucide-react';
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
import { t } from '@/i18n';

const TABS: Array<{ value: OpenRequestScope; label: string }> = [
  { value: 'all', label: t('Barcha faol') },
  { value: 'mine', label: t('Menga mos') },
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
        <div>
          <h1>{t('Faol takliflar')}</h1>
          <p className="gm-page-lead">{t('Mijozlar yuborgan va hozir ustalarni kutayotgan so‘rovlar. Yoqqanini «Qabul qilish» bilan oling — narxingiz mijozga taklif sifatida boradi.')}</p>
        </div>
      </div>

      <div className="gm-tabs" role="tablist" aria-label={t('Ko‘rinish')}>
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

      {requests.isLoading && <PageLoader label={t('Takliflar yuklanmoqda…')} />}
      {requests.isError && <Alert tone="danger">{getErrorMessage(requests.error)}</Alert>}
      {requests.data && items.length === 0 && (
        <EmptyState
          icon={<Inbox size={34} strokeWidth={1.8} />}
          steps={[
            { icon: <Send size={16} aria-hidden="true" />, title: t('Mijoz so‘rov yuboradi'), text: t('Yangi so‘rov kelganda shu yerda paydo bo‘ladi.') },
            { icon: <CheckCircle2 size={16} aria-hidden="true" />, title: t('Qabul qilasiz'), text: t('«Qabul qilish» tugmasi bilan narxingizni taklif qilasiz.') },
            { icon: <Users size={16} aria-hidden="true" />, title: t('Mijoz tanlaydi'), text: t('Mijoz takliflarni solishtirib, ustani tanlaydi.') },
          ]}
          title={t('Hozircha faol takliflar yo‘q')}
          description={
            scope === 'mine'
              ? t('«Barcha faol» bo‘limida boshqa xizmatlar bo‘yicha so‘rovlarni ham ko‘rishingiz mumkin.')
              : t('Yangi so‘rov kelganda shu yerda paydo bo‘ladi.')
          }
        />
      )}

      <div className="gm-list">
        {items.map((request) => (
          <div key={request.id} className="gm-card">
            <div className="gm-card__header">
              <h3>{request.title}</h3>
              <div className="gm-action-row">
                {request.notified && <Badge tone="primary">{t('Sizga yuborilgan')}</Badge>}
                {request.service && <Badge tone="neutral">{request.service.name}</Badge>}
                {request.expiresAt && <ExpiryCountdown expiresAt={request.expiresAt} />}
              </div>
            </div>
            <p className="gm-request-card__description">{request.description}</p>
            <p className="gm-card__meta gm-offer-meta">
              <span>
                <Users size={14} />{' '}{t('Takliflar: {offersCount}', { offersCount: request.offersCount })}</span>
              <span>
                <CalendarClock size={14} /> {formatRelativeTime(request.createdAt)}
              </span>
              {request.preferredStartAt && <span>{t('Xohlangan vaqt:')}{' '}{formatDateTime(request.preferredStartAt)}</span>}
              {request.expiresAt && <span>{t('Taklif muddati:')}{' '}{formatDateTime(request.expiresAt)}</span>}
            </p>

            <div className="gm-action-row" style={{ marginTop: 'var(--gm-space-3)' }}>
              {request.myOffer ? (
                <>
                  <OfferBadge status={request.myOffer.status} />
                  <span className="gm-card__meta" style={{ margin: 0 }}>{t('Sizning taklifingiz: {money}', { money: formatMoney(request.myOffer.price) })}</span>
                </>
              ) : (
                <Button size="sm" onClick={() => setSelected(request)}>
                  <CheckCircle2 size={16} />{' '}{t('Qabul qilish')}</Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {requests.hasNextPage && (
        <div style={{ marginTop: 'var(--gm-space-4)', textAlign: 'center' }}>
          <Button variant="secondary" loading={requests.isFetchingNextPage} onClick={() => void requests.fetchNextPage()}>{t('Yana yuklash')}</Button>
        </div>
      )}

      {selected && <AcceptRequestDialog request={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
