import { ComplaintForm } from '@/features/complaint/components/ComplaintForm';
import { ComplaintList } from '@/features/complaint/components/ComplaintList';
import { t } from '@/i18n';

export function ComplaintsPage() {
  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>{t('Shikoyatlar')}</h1>
          <p className="gm-page-lead">{t('Shikoyat yuboring va ko‘rib chiqilishini kuzating.')}</p>
        </div>
      </div>
      <ComplaintList />
      <section className="gm-detail-section">
        <h2>{t('Yangi shikoyat')}</h2>
        <ComplaintForm />
      </section>
    </div>
  );
}
