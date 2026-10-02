import { AvailabilityEditor } from '@/features/master/components/AvailabilityEditor';
import { t } from '@/i18n';

export function MasterSchedulePage() {
  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>{t('Ish jadvali')}</h1>
          <p className="gm-page-lead">{t('Mijozlar band qila oladigan ish vaqtlaringiz.')}</p>
        </div>
      </div>
      <AvailabilityEditor />
    </div>
  );
}
