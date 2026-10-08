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
import { FaqSection } from './FaqSection';
import { usePublicMasters, usePublicPlans, usePublicStats } from './hooks';
import { MasterTile } from './MasterTile';
import { t } from '@/i18n';
import './public.css';

const monthsLabel = (months: number) => (months === 12 ? t('1 yil') : t('{months} oy', { months }));
const METHOD_NAME: Record<string, () => string> = { CLICK: () => 'Click', PAYME: () => 'Payme', UZUM: () => 'Uzum', CARD: () => t('Karta') };

function Catalog() {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const q = useDebounce(text, 300);
  const categories = useServiceCategories();
  const masters = usePublicMasters(category, q.trim());
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

function Prices() {
  const plans = usePublicPlans();
  if (!plans.data && !plans.isError) return null;
  return (
    <section className="gm-show__block" id="narxlar">
      <header>
        <div>
          <h2>{t('Narxlar')}</h2>
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

/** Bosh sahifadagi jonli bo‘limlar (alohida sahifalarsiz): raqamlar, usta katalogi, narxlar, savollar. Havolalar — shu sahifa ichidagi bo‘limlarga. */
export function PublicShowcase() {
  const stats = usePublicStats();
  return (
    <div className="gm-show">
      {stats.data && stats.data.masters > 0 && (
        <ul className="gm-pub__stats gm-show__stats">
          <li><strong>{stats.data.masters}</strong><span>{t('tasdiqlangan usta')}</span></li>
          <li><strong>{stats.data.completedOrders}</strong><span>{t('bajarilgan ish')}</span></li>
          <li><strong>{stats.data.services}</strong><span>{t('xizmat turi')}</span></li>
          {stats.data.avgRating != null && <li><strong>{stats.data.avgRating.toFixed(1)}</strong><span>{t('o‘rtacha reyting')}</span></li>}
        </ul>
      )}
      <Catalog />
      <Prices />
      <FaqSection />
      <section className="gm-show__join">
        <h2>{t('Boshlaymizmi?')}</h2>
        <div>
          <a className="gm-pub__cta" href={env.customerUrl}>{t('Mijoz sifatida boshlash')}</a>
          <a className="gm-pub__cta gm-pub__cta--ghost" href={env.masterUrl}>{t('Usta sifatida qo‘shilish')}</a>
        </div>
      </section>
    </div>
  );
}
