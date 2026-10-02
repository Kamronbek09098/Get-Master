import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { useMyMasterProfile } from '@/features/master/hooks/useMaster';
import { PortfolioManager } from '@/features/master/components/PortfolioManager';
import { t } from '@/i18n';

export function MasterPortfolioPage() {
  const profile = useMyMasterProfile();
  if (profile.isLoading) return <PageLoader label={t('Profil yuklanmoqda…')} />;
  if (!profile.data) {
    return <EmptyState title={t('Avval usta profilini yarating')} description={t('«Profil» bo‘limida profilingizni to‘ldiring.')} />;
  }
  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>{t('Portfolio')}</h1>
          <p className="gm-page-lead">{t('Ish namunalaringiz admin tasdiqlagach mijozlarga ko‘rinadi.')}</p>
        </div>
      </div>
      <PortfolioManager masterId={profile.data.id} />
    </div>
  );
}
