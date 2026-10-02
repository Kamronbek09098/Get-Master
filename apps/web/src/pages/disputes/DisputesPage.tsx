import { DisputeList } from '@/features/dispute/components/DisputeList';
import { t } from '@/i18n';

export function DisputesPage() {
  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>{t('Nizolarim')}</h1>
          <p className="gm-page-lead">{t('Buyurtmalar bo‘yicha ochilgan nizolar.')}</p>
        </div>
      </div>
      <DisputeList />
    </div>
  );
}
