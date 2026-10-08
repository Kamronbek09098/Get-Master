import { BadgeCheck, Briefcase, Images, Star } from 'lucide-react';
import { env } from '@/lib/env';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import type { PublicMaster } from './public.service';

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join('');
}

export function MasterTile({ master }: { master: PublicMaster }) {
  return (
    <article className={cx('gm-pub__master', master.isPro && 'gm-pub__master--pro')}>
      <div className="gm-pub__master-head">
        <span className="gm-pub__avatar" aria-hidden="true">{initials(master.name)}</span>
        <div>
          <h3>
            {master.name}
            {master.isPro && <span className="gm-pub__pro" title={t('Pro obunali usta')}><BadgeCheck size={14} aria-hidden="true" /> Pro</span>}
          </h3>
          <p>{master.profession || t('Usta')}</p>
        </div>
      </div>
      <div className="gm-pub__master-stats">
        <span title={t('Reyting')}><Star size={14} aria-hidden="true" /> {master.reviews > 0 ? `${master.rating.toFixed(1)} (${master.reviews})` : t('Yangi')}</span>
        <span><Briefcase size={14} aria-hidden="true" /> {t('{count} ta ish', { count: master.completedOrders })}</span>
        {master.works > 0 && <span><Images size={14} aria-hidden="true" /> {t('{count} ta rasm', { count: master.works })}</span>}
      </div>
      {master.services.length > 0 && (
        <ul className="gm-pub__chips">
          {master.services.map((service) => <li key={service}>{service}</li>)}
        </ul>
      )}
      <a className="gm-pub__master-cta" href={env.customerUrl}>{t('Bog‘lanish uchun ro‘yxatdan o‘ting')}</a>
    </article>
  );
}
