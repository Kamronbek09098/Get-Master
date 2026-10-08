import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, CheckCircle2, Inbox, Send, Users } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { cx } from '@/lib/utils';
import { getErrorMessage } from '@/lib/error-messages';
import { AcceptRequestDialog } from '@/features/offer/components/AcceptRequestDialog';
import { PausedNotice, usePaused } from '@/features/master/components/PausedNotice';
import { MyOffersList } from '@/features/offer/components/MyOffersList';
import { OpenRequestCard } from '@/features/offer/components/OpenRequestCard';
import { useOpenRequests } from '@/features/offer/hooks/useOffers';
import type { OpenRequest, OpenRequestScope } from '@/features/offer/types';
import { t } from '@/i18n';
import './ActiveOffers.css';

type View = 'all' | 'notified' | 'sent';
const TABS: Array<{ value: View; label: string }> = [
  { value: 'all', label: t('Faol') },
  { value: 'notified', label: t('Sizga yuborilgan') },
  { value: 'sent', label: t('Yuborgan takliflarim') },
];

const SKIPPED_KEY = 'getmaster.skipped-requests';
function readSkipped(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(SKIPPED_KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((value): value is string => typeof value === 'string') : []);
  } catch {
    return new Set();
  }
}
function saveSkipped(value: Set<string>) {
  try {
    localStorage.setItem(SKIPPED_KEY, JSON.stringify([...value].slice(-300)));
  } catch {
    /* saqlab bo‘lmasa ham ishlayveradi */
  }
}

function OpenRequestsView({ scope, onShowAll, onToggleMine }: { scope: OpenRequestScope; onShowAll: () => void; onToggleMine?: () => void }) {
  const [selected, setSelected] = useState<OpenRequest | null>(null);
  const requests = useOpenRequests(scope);
  const paused = usePaused();
  const items = requests.data?.pages.flatMap((page) => page.items) ?? [];
  const [skipped, setSkipped] = useState<Set<string>>(readSkipped);
  const visible = items.filter((item) => !skipped.has(item.id));

  function skip(id: string) {
    const next = new Set(skipped).add(id);
    setSkipped(next);
    saveSkipped(next);
  }
  function restoreSkipped() {
    setSkipped(new Set());
    saveSkipped(new Set());
  }

  return (
    <>
      {onToggleMine && (
        <div className="gm-chips gm-offers-filter">
          <button type="button" className={cx('gm-chip', scope === 'mine' && 'gm-chip--on')} aria-pressed={scope === 'mine'} onClick={onToggleMine}>
            {scope === 'mine' && <Check size={15} aria-hidden="true" />}
            {t('Menga mos')}
          </button>
          {requests.data && <span className="gm-offers-filter__count">{t('{count} ta so‘rov', { count: visible.length })}</span>}
        </div>
      )}
      {requests.isLoading && <PageLoader label={t('Takliflar yuklanmoqda…')} />}
      {requests.isError && <Alert tone="danger">{getErrorMessage(requests.error)}</Alert>}
      {requests.data && visible.length === 0 && (
        <EmptyState
          icon={<Inbox size={34} strokeWidth={1.8} />}
          steps={[
            {
              icon: <Send size={16} aria-hidden="true" />,
              title: t('Mijoz so‘rov yuboradi'),
              text: t('Yangi so‘rov kelganda shu yerda paydo bo‘ladi.'),
            },
            {
              icon: <CheckCircle2 size={16} aria-hidden="true" />,
              title: t('Taklif berasiz'),
              text: t('«Taklif berish» tugmasi bilan narxingizni yuborasiz.'),
            },
            {
              icon: <Users size={16} aria-hidden="true" />,
              title: t('Mijoz tanlaydi'),
              text: t('Mijoz takliflarni solishtirib, ustani tanlaydi.'),
            },
          ]}
          title={scope === 'notified' ? t('Sizga yuborilgan so‘rovlar yo‘q') : scope === 'mine' ? t('Sizga mos so‘rovlar yo‘q') : t('Hozircha takliflar yo‘q')}
          description={
            scope === 'all'
              ? t('Yangi so‘rov kelganda shu yerda paydo bo‘ladi.')
              : scope === 'notified'
                ? t('Tizim sizga mos so‘rov topganda, u shu yerda paydo bo‘ladi va bildirishnoma keladi.')
                : t('Xizmatlaringizga mos yangi so‘rov kelganda shu yerda paydo bo‘ladi.')
          }
          action={
            scope !== 'all' ? (
              <Button variant="secondary" onClick={onShowAll}>
                {t('Barcha so‘rovlarni ko‘rish')}
              </Button>
            ) : undefined
          }
        />
      )}

      {skipped.size > 0 && items.some((item) => skipped.has(item.id)) && (
        <p className="gm-skipped">
          {t('O‘tkazib yuborilgan: {count} ta', {
            count: items.filter((item) => skipped.has(item.id)).length,
          })}{' '}
          <button type="button" onClick={restoreSkipped}>
            {t('Qayta ko‘rsatish')}
          </button>
        </p>
      )}

      <div className="gm-orc-list">
        {visible.map((request) => (
          <OpenRequestCard key={request.id} request={request} paused={paused} onAccept={() => setSelected(request)} onSkip={() => skip(request.id)} />
        ))}
      </div>

      {requests.hasNextPage && (
        <div style={{ marginTop: 'var(--gm-space-4)', textAlign: 'center' }}>
          <Button variant="secondary" loading={requests.isFetchingNextPage} onClick={() => void requests.fetchNextPage()}>
            {t('Yana yuklash')}
          </Button>
        </div>
      )}

      {selected && <AcceptRequestDialog request={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

export function ActiveOffersPage() {
  const [params, setParams] = useSearchParams();
  const view: View = TABS.some((tab) => tab.value === params.get('korinish')) ? (params.get('korinish') as View) : 'all';
  const mine = view === 'all' && params.get('mos') === '1';
  const reset = () => setParams({}, { replace: true });
  const paused = usePaused();

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>{t('Takliflar')}</h1>
          <p className="gm-page-lead">{t('Mijozlar yuborgan va ustalarni kutayotgan so‘rovlar. Yoqqaniga «Taklif berish» bosing: narxingiz mijozga taklif sifatida boradi.')}</p>
        </div>
      </div>

      {paused && <PausedNotice />}

      <div className="gm-tabs gm-offers-tabs" role="tablist" aria-label={t('Ko‘rinish')}>
        {TABS.map((tab) => (
          <Button
            key={tab.value}
            size="sm"
            role="tab"
            aria-selected={view === tab.value}
            variant={view === tab.value ? 'primary' : 'secondary'}
            onClick={() =>
              setParams(tab.value === 'all' ? {} : { korinish: tab.value }, {
                replace: true,
              })
            }
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {view === 'sent' ? (
        <MyOffersList onBrowse={reset} />
      ) : view === 'notified' ? (
        <OpenRequestsView scope="notified" onShowAll={reset} />
      ) : (
        <OpenRequestsView scope={mine ? 'mine' : 'all'} onShowAll={reset} onToggleMine={() => setParams(mine ? {} : { mos: '1' }, { replace: true })} />
      )}
    </div>
  );
}
