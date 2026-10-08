import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Users } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatMoney } from '@/lib/utils';
import { usePublicPrices } from '@/features/public/hooks';
import { t } from '@/i18n';
import './ServicesPage.css';

/** Xizmatlar: kategoriya bo‘yicha xizmat kartalari, ustalar belgilagan eng past narx bilan. */
export function ServicesPage() {
  const prices = usePublicPrices();
  const [category, setCategory] = useState('');
  const categories = prices.data ?? [];
  const list = categories.filter((item) => !category || item.id === category);

  return (
    <div className="gm-svc">
      <div className="gm-page-header">
        <div>
          <h1>{t('Xizmatlar')}</h1>
          <p className="gm-page-lead">{t('Kerakli xizmatni tanlang va buyurtma bering. Narxlar ustalar belgilagan eng past qiymatlardan olingan.')}</p>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="gm-svc__chips" role="group" aria-label={t('Kategoriyalar')}>
          <button type="button" aria-pressed={!category} className={cx(!category && 'is-active')} onClick={() => setCategory('')}>{t('Barchasi')}</button>
          {categories.map((item) => (
            <button key={item.id} type="button" aria-pressed={category === item.id} className={cx(category === item.id && 'is-active')} onClick={() => setCategory(item.id)}>{item.name}</button>
          ))}
        </div>
      )}

      {prices.isLoading && <PageLoader />}
      {prices.isError && <Alert tone="danger">{getErrorMessage(prices.error)}</Alert>}
      {prices.data && list.length === 0 && <EmptyState title={t('Hozircha xizmatlar yo‘q')} />}

      <div className="gm-svc__list">
        {list.flatMap((item) =>
          item.services.map((service) => (
            <article key={service.id} className="gm-svc__card">
              <header>
                <span className="gm-svc__tag">{item.name}</span>
                <span className="gm-svc__masters"><Users size={14} aria-hidden="true" /> {t('{count} ta usta', { count: service.masters })}</span>
              </header>
              <h3>{service.name}</h3>
              <p className="gm-svc__price">{service.minPrice != null ? <><small>{t('dan')}</small> {formatMoney(service.minPrice)}</> : t('Kelishiladi')}</p>
              <div className="gm-svc__actions">
                <Link to="/mijoz/sorov-yaratish" className="gm-button gm-button--primary gm-button--lg gm-button--full">{t('Buyurtma berish')}</Link>
                <Link to={`/mijoz/ustalar?kategoriya=${item.id}`} className="gm-svc__more">{t('Ustalarni ko‘rish')} <ArrowRight size={16} aria-hidden="true" /></Link>
              </div>
            </article>
          )),
        )}
      </div>
    </div>
  );
}
