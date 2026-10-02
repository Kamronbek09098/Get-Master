import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { useMatching } from '../hooks/useMatching';
import { t } from '@/i18n';

const STATUS_LABEL: Record<string, string> = {
  PENDING: t('Kutilmoqda'),
  RUNNING: t('Ustalar izlanmoqda'),
  COMPLETED: t('Qidiruv yakunlandi'),
  FAILED: t('Qidiruvda xatolik yuz berdi'),
};

export function MatchingResults({ requestId, serviceSelected = true }: { requestId: string; serviceSelected?: boolean }) {
  const matching = useMatching(requestId);

  if (matching.isLoading) return <PageLoader label={t('Mos ustalar yuklanmoqda…')} />;
  if (matching.isError) return <Alert tone="danger">{getErrorMessage(matching.error)}</Alert>;
  if (!matching.data?.run) {
    return serviceSelected ? (
      <EmptyState
        title={t('Ustalar izlanmoqda')}
        description={t('Qidiruv bir necha soniyada boshlanadi. Bu sahifa o‘zi yangilanadi.')}
      />
    ) : (
      <EmptyState title={t('Xizmat turi tanlanmagan')} description={t('Yuqoridagi «Xizmat turini tanlang» bo‘limidan tanlang — shunda ustalar qidiriladi.')} />
    );
  }

  const results = matching.data.results;
  return (
    <div className="gm-list">
      <p className="gm-rqd__run">{STATUS_LABEL[matching.data.run.status] ?? matching.data.run.status}</p>
      {results.length === 0 && (
        <EmptyState
          title={t('Hozircha mos usta topilmadi')}
          description={t('Ustalar o‘zlari ham so‘rovingizga taklif yuborishi mumkin. Yangi takliflar «Takliflar» bo‘limida ko‘rinadi.')}
        />
      )}
      {results.map((result, index) => (
        <Link key={result.id} to={`/ustalar-katalogi/${result.master?.user.accountNumber ?? result.masterId}`} className="gm-card">
          <div className="gm-card__header">
            <h3>{index + 1}{t('-o‘rin')}</h3>
            {result.score && <span>{t('Ball:')}{' '}{Number(result.score).toFixed(2)}</span>}
          </div>
          {result.distanceKm && <p className="gm-card__meta">{t('Masofa: {toFixed} km', { toFixed: Number(result.distanceKm).toFixed(1) })}</p>}
        </Link>
      ))}
    </div>
  );
}
