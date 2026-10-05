import { MessageSquareWarning } from 'lucide-react';
import { ComplaintForm } from '@/features/complaint/components/ComplaintForm';
import { ComplaintList } from '@/features/complaint/components/ComplaintList';
import { t } from '@/i18n';
import './ComplaintsPage.css';

export function ComplaintsPage() {
  return (
    <div className="gm-cplt">
      <div className="gm-page-header">
        <div>
          <h1>{t('Shikoyatlar')}</h1>
          <p className="gm-page-lead">{t('Shikoyat yuboring va ko‘rib chiqilishini kuzating.')}</p>
        </div>
      </div>

      <section className="gm-cplt__card gm-cplt__new">
        <header className="gm-cplt__head">
          <span className="gm-cplt__icon" aria-hidden="true">
            <MessageSquareWarning size={20} />
          </span>
          <div>
            <h2>{t('Yangi shikoyat')}</h2>
            <p>{t('Mavzu va batafsil tavsifni kiriting.')}</p>
          </div>
        </header>
        <ComplaintForm />
      </section>

      <section className="gm-cplt__list" aria-label={t('Shikoyatlar')}>
        <ComplaintList />
      </section>
    </div>
  );
}
