import { useState } from 'react';
import { CheckCircle2, Inbox, Send, Users } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { AcceptRequestDialog } from '@/features/offer/components/AcceptRequestDialog';
import { PausedNotice, usePaused } from '@/features/master/components/PausedNotice';
import { OpenRequestCard } from '@/features/offer/components/OpenRequestCard';
import { useOpenRequests } from '@/features/offer/hooks/useOffers';
import type { OpenRequest, OpenRequestScope } from '@/features/offer/types';
import { t } from '@/i18n';
import './ActiveOffers.css';

const TABS: Array<{ value: OpenRequestScope; label: string }> = [
  { value: 'all', label: t('Barcha faol') },
  { value: 'mine', label: t('Menga mos') },
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

export function ActiveOffersPage() {
  const [scope, setScope] = useState<OpenRequestScope>('all');
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
    <div>
      <div className="gm-page-header">
        <div>
          <h1>{t('Faol takliflar')}</h1>
          <p className="gm-page-lead">{t('Mijozlar yuborgan va hozir ustalarni kutayotgan so‘rovlar. Yoqqanini «Taklif berish» bilan oling — narxingiz mijozga taklif sifatida boradi.')}</p>
        </div>
      </div>

      {paused && <PausedNotice />}

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
      {requests.data && visible.length === 0 && (
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

      {skipped.size > 0 && items.some((item) => skipped.has(item.id)) && (
        <p className="gm-skipped">
          {t('O‘tkazib yuborilgan: {count} ta', { count: items.filter((item) => skipped.has(item.id)).length })}{' '}
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
          <Button variant="secondary" loading={requests.isFetchingNextPage} onClick={() => void requests.fetchNextPage()}>{t('Yana yuklash')}</Button>
        </div>
      )}

      {selected && <AcceptRequestDialog request={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
