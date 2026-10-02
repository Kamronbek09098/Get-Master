import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { useMatching } from '../hooks/useMatching';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Kutilmoqda',
  RUNNING: 'Ustalar izlanmoqda',
  COMPLETED: 'Qidiruv yakunlandi',
  FAILED: 'Qidiruvda xatolik yuz berdi',
};

export function MatchingResults({ requestId, serviceSelected = true }: { requestId: string; serviceSelected?: boolean }) {
  const matching = useMatching(requestId);

  if (matching.isLoading) return <PageLoader label="Mos ustalar yuklanmoqda…" />;
  if (matching.isError) return <Alert tone="danger">{getErrorMessage(matching.error)}</Alert>;
  if (!matching.data?.run) {
    return serviceSelected ? (
      <EmptyState
        title="Ustalar izlanmoqda"
        description="Qidiruv bir necha soniyada boshlanadi. Bu sahifa o‘zi yangilanadi."
      />
    ) : (
      <EmptyState title="Xizmat turi tanlanmagan" description="Yuqoridagi «Xizmat turini tanlang» bo‘limidan tanlang — shunda ustalar qidiriladi." />
    );
  }

  const results = matching.data.results;
  return (
    <div className="gm-list">
      <p className="gm-rqd__run">{STATUS_LABEL[matching.data.run.status] ?? matching.data.run.status}</p>
      {results.length === 0 && (
        <EmptyState
          title="Hozircha mos usta topilmadi"
          description="Ustalar o‘zlari ham so‘rovingizga taklif yuborishi mumkin. Yangi takliflar «Takliflar» bo‘limida ko‘rinadi."
        />
      )}
      {results.map((result, index) => (
        <Link key={result.id} to={`/ustalar-katalogi/${result.master?.user.accountNumber ?? result.masterId}`} className="gm-card">
          <div className="gm-card__header">
            <h3>{index + 1}-o‘rin</h3>
            {result.score && <span>Ball: {Number(result.score).toFixed(2)}</span>}
          </div>
          {result.distanceKm && <p className="gm-card__meta">Masofa: {Number(result.distanceKm).toFixed(1)} km</p>}
        </Link>
      ))}
    </div>
  );
}
