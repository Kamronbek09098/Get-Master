import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Crown } from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import { Column, FAQ_PREVIEW } from './FaqSection';
import { usePublicMasters, usePublicPlans, usePublicStats } from './hooks';
import { MasterTile } from './MasterTile';
import { t } from '@/i18n';
import './public.css';

/** Bosh sahifadagi ixcham bo‘limlar. To‘liq katalog, narxlar va savollar — yagona `/katalog` sahifasida. */
export function PublicShowcase() {
  const stats = usePublicStats();
  const masters = usePublicMasters('', '');
  const plans = usePublicPlans();
  const top = (masters.data?.pages[0]?.items ?? []).slice(0, 3);

  return (
    <div className="gm-show">
      {top.length > 0 && (
        <section className="gm-show__block" id="ustalar">
          <header className="gm-show__head">
            <p className="gm-show__kicker">{t('Ustalar')}</p>
            <h2>{t('Eng yaxshi ustalar')}</h2>
            {stats.data && stats.data.masters > 0 && (
              <p className="gm-show__lead">
                {t('{count} ta tasdiqlangan usta', { count: stats.data.masters })} · {t('{count} ta bajarilgan ish', { count: stats.data.completedOrders })}
                {stats.data.avgRating != null ? ` · ★ ${stats.data.avgRating.toFixed(1)}` : ''}
              </p>
            )}
          </header>
          <div className="gm-pub__grid">
            {top.map((master) => <MasterTile key={master.id} master={master} />)}
          </div>
          <Link to="/katalog#ustalar" className="gm-show__all">{t('Barcha ustalarni ko‘rish')} <ArrowRight size={17} aria-hidden="true" /></Link>
        </section>
      )}

      {plans.data && (
        <section className="gm-show__block" id="narxlar">
          <header className="gm-show__head">
            <p className="gm-show__kicker">{t('Narxlar')}</p>
            <h2>{t('Ro‘yxatdan o‘tish bepul')}</h2>
            <p className="gm-show__lead">{t('Obuna — qo‘shimcha imkoniyatlar uchun ixtiyoriy.')}</p>
          </header>
          <div className="gm-show__plans">
            {plans.data.plans.map((plan) => (
              <Link key={plan.code} to="/katalog#obuna" className={plan.audience === 'MASTER' ? 'gm-show__plan gm-show__plan--master' : 'gm-show__plan'}>
                <span className="gm-show__plan-name">{plan.audience === 'MASTER' ? <BadgeCheck size={18} aria-hidden="true" /> : <Crown size={18} aria-hidden="true" />} {plan.name}</span>
                <small>{plan.tagline}</small>
                <strong>{formatMoney(plan.prices[0]?.price ?? 0, plans.data.currency)} <em>/ {t('{months} oy', { months: 1 })}</em></strong>
              </Link>
            ))}
          </div>
          <Link to="/katalog#obuna" className="gm-show__all">{t('Obuna imkoniyatlari')} <ArrowRight size={17} aria-hidden="true" /></Link>
        </section>
      )}

      <section className="gm-show__block" id="savollar">
        <header className="gm-show__head gm-show__head--faq">
          <span className="gm-faq__pill">FAQ</span>
          <h2>{t('Ko‘p beriladigan savollar')}</h2>
        </header>
        <div className="gm-faq gm-faq--single">
          <Column items={FAQ_PREVIEW} offset={0} />
        </div>
        <Link to="/katalog#savollar" className="gm-show__all">{t('Barcha savollar')} <ArrowRight size={17} aria-hidden="true" /></Link>
      </section>

    </div>
  );
}
