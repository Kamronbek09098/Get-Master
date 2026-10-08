import { useState } from 'react';
import { Check, Crown, BadgeCheck, Search, UserRound, Wrench } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useDebounce } from '@/hooks/useDebounce';
import { env } from '@/lib/env';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatMoney } from '@/lib/utils';
import { useServiceCategories } from '@/features/service/hooks/useServices';
import { FEATURE_META } from '@/features/subscription/meta';
import { usePublicMasters, usePublicPlans, usePublicPrices } from './hooks';
import { MasterTile } from './MasterTile';
import { t } from '@/i18n';
import './public.css';

const monthsLabel = (months: number) => (months === 12 ? t('1 yil') : t('{months} oy', { months }));
const METHOD_NAME: Record<string, () => string> = { CLICK: () => 'Click', PAYME: () => 'Payme', UZUM: () => 'Uzum', CARD: () => t('Karta') };

export function CatalogSection({ initialCategory = '' }: { initialCategory?: string }) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const q = useDebounce(text, 300);
  const categories = useServiceCategories();
  const [mode, setMode] = useState('');
  const masters = usePublicMasters(category, q.trim(), mode);
  const items = masters.data?.pages.flatMap((page) => page.items) ?? [];
  const total = masters.data?.pages[0]?.total ?? 0;
  return (
    <section className="gm-show__block" id="ustalar">
      <header>
        <div>
          <h2>{t('Tasdiqlangan ustalar katalogi')}</h2>
          <p>{t('Reyting va ish tajribasi bo‘yicha ustani tanlang. Bog‘lanish va buyurtma berish uchun bepul ro‘yxatdan o‘ting.')}</p>
        </div>
      </header>
      <div className="gm-pub__filters">
        <label className="gm-pub__search">
          <Search size={17} aria-hidden="true" />
          <input value={text} onChange={(event) => setText(event.target.value)} maxLength={80} placeholder={t('Kasb, xizmat yoki ism bo‘yicha qidirish')} aria-label={t('Qidirish')} />
        </label>
        <div className="gm-pub__cats" role="group" aria-label={t('Qayerda xizmat ko‘rsatadi')}>
          {[['', t('Hammasi')], ['AT_CUSTOMER', t('Uyga boradi')], ['AT_MASTER', t('O‘z joyida qabul qiladi')]].map(([value, label]) => (
            <button key={value} type="button" aria-pressed={mode === value} className={cx(mode === value && 'is-active')} onClick={() => setMode(value!)}>{label}</button>
          ))}
        </div>
        <div className="gm-pub__cats" role="tablist" aria-label={t('Kategoriyalar')}>
          <button type="button" role="tab" aria-selected={!category} className={cx(!category && 'is-active')} onClick={() => setCategory('')}>{t('Barchasi')}</button>
          {(categories.data ?? []).map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={category === item.id} className={cx(category === item.id && 'is-active')} onClick={() => setCategory(item.id)}>{item.name}</button>
          ))}
        </div>
      </div>
      {masters.isLoading && <PageLoader />}
      {masters.isError && <Alert tone="danger">{getErrorMessage(masters.error)}</Alert>}
      {!masters.isLoading && !masters.isError && items.length === 0 && (
        <EmptyState icon={<UserRound size={26} />} title={t('Hech kim topilmadi')} description={t('Boshqa kategoriya yoki so‘z bilan urinib ko‘ring.')} />
      )}
      {items.length > 0 && (
        <>
          <p className="gm-pub__count">{t('{count} ta usta topildi', { count: total })}</p>
          <div className="gm-pub__grid">
            {items.map((master) => <MasterTile key={master.id} master={master} />)}
          </div>
          {masters.hasNextPage && (
            <div className="gm-pub__more">
              <Button variant="secondary" loading={masters.isFetchingNextPage} onClick={() => void masters.fetchNextPage()}>{t('Yana ko‘rsatish')}</Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function PlansSection() {
  const plans = usePublicPlans();
  if (!plans.data && !plans.isError) return null;
  return (
    <section className="gm-show__block" id="obuna">
      <header>
        <div>
          <h2>{t('Obuna rejalari')}</h2>
          <p>{t('Ro‘yxatdan o‘tish va buyurtma berish bepul. Obuna — qo‘shimcha imkoniyatlar uchun ixtiyoriy.')}</p>
        </div>
      </header>
      {plans.isError && <Alert tone="danger">{getErrorMessage(plans.error)}</Alert>}
      <div className="gm-pub__plans">
        {plans.data?.plans.map((plan) => {
          const master = plan.audience === 'MASTER';
          return (
            <article key={plan.code} className={master ? 'gm-pub__plan gm-pub__plan--master' : 'gm-pub__plan'}>
              <header>
                <span className="gm-pub__plan-icon" aria-hidden="true">{master ? <Wrench size={20} /> : <UserRound size={20} />}</span>
                <div>
                  <h3>{master ? <BadgeCheck size={17} aria-hidden="true" /> : <Crown size={17} aria-hidden="true" />} {plan.name}</h3>
                  <p>{plan.tagline}</p>
                </div>
              </header>
              <ul className="gm-pub__prices">
                {plan.prices.map((price) => (
                  <li key={price.months}>
                    <span>{monthsLabel(price.months)}</span>
                    <strong>{formatMoney(price.price, plans.data.currency)}</strong>
                    {price.savingPercent > 0 && <em>−{price.savingPercent}%</em>}
                  </li>
                ))}
              </ul>
              <ul className="gm-pub__features">
                {plan.features.map((feature) => (
                  <li key={feature}><Check size={16} aria-hidden="true" /> <span><b>{FEATURE_META[feature].title()}</b> {FEATURE_META[feature].text()}</span></li>
                ))}
              </ul>
              <a className="gm-pub__cta gm-pub__cta--block" href={master ? env.masterUrl : env.customerUrl}>{master ? t('Usta sifatida boshlash') : t('Mijoz sifatida boshlash')}</a>
            </article>
          );
        })}
      </div>
      {plans.data?.allMethods && (
        <p className="gm-pub__note">{t('To‘lov usullari')}: {plans.data.allMethods.map((item) => METHOD_NAME[item.method]?.() ?? item.method).join(' · ')}</p>
      )}
    </section>
  );
}


/** Xizmat narxlari: kategoriya bo‘yicha ustalar belgilagan eng past narxlar («dan …»). */
export function ServicePricesSection({ onShowMasters }: { onShowMasters: (categoryId: string) => void }) {
  const prices = usePublicPrices();
  const [filter, setFilter] = useState('');
  const list = (prices.data ?? []).filter((category) => !filter || category.id === filter);
  return (
    <section className="gm-show__block" id="narxlar">
      <header>
        <div>
          <h2>{t('O‘zbekistonda xizmatlar qancha turadi')}</h2>
          <p>{t('Narxlar ustalar belgilagan eng past qiymatlardan olinadi. Aniq narxni usta ish hajmiga qarab taklif qiladi.')}</p>
        </div>
      </header>
      <label className="gm-pub__select">
        <span className="gm-visually-hidden">{t('Kategoriya')}</span>
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">{t('Hamma kategoriyalar')}</option>
          {(prices.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      {prices.isLoading && <PageLoader />}
      {prices.isError && <Alert tone="danger">{getErrorMessage(prices.error)}</Alert>}
      <div className="gm-pub__pricegrid">
        {list.map((category) => (
          <article key={category.id} className="gm-pub__pricecard">
            <header>
              <h3>{category.name}</h3>
              <span className="gm-pub__badge">{t('{count} ta usta', { count: category.masters })}</span>
            </header>
            <ul>
              {category.services.map((service) => (
                <li key={service.id}>
                  <span>{service.name}</span>
                  <b>{service.minPrice != null ? t('{price} dan', { price: formatMoney(service.minPrice) }) : t('Kelishiladi')}</b>
                </li>
              ))}
            </ul>
            <div className="gm-pub__pricecard-actions">
              <button type="button" className="gm-pub__btn" onClick={() => onShowMasters(category.id)}>{t('Ustalarni ko‘rsatish')}</button>
              <a className="gm-pub__cta" href={env.customerUrl}>{t('Buyurtma qoldirish')}</a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
