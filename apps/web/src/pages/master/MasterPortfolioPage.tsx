import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { useMyMasterProfile } from '@/features/master/hooks/useMaster';
import { PortfolioManager } from '@/features/master/components/PortfolioManager';

export function MasterPortfolioPage() {
  const profile = useMyMasterProfile();
  if (profile.isLoading) return <PageLoader label="Profil yuklanmoqda…" />;
  if (!profile.data) {
    return <EmptyState title="Avval usta profilini yarating" description="«Profil» bo‘limida profilingizni to‘ldiring." />;
  }
  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>Portfolio</h1>
          <p className="gm-page-lead">Ish namunalaringiz admin tasdiqlagach mijozlarga ko‘rinadi.</p>
        </div>
      </div>
      <PortfolioManager masterId={profile.data.id} />
    </div>
  );
}
