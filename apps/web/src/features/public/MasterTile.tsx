import { BadgeCheck, Briefcase, Images, MapPin, Star } from 'lucide-react';
import { ModeBadges } from '@/features/service/ModeBadges';
import { env } from '@/lib/env';
import { cx, formatMoney } from '@/lib/utils';
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
      <ModeBadges modes={master.serviceModes} size="sm" />
      {master.regionName && <p className="gm-pub__place"><MapPin size={13} aria-hidden="true" /> {master.regionName}</p>}
      {master.serviceModes?.includes('AT_MASTER') && master.placeAddress && <p className="gm-pub__place"><MapPin size={13} aria-hidden="true" /> {master.placeAddress}</p>}
      {master.services.length > 0 && (
        <ul className="gm-pub__svc">
          {master.services.map((service) => (
            <li key={service.name}>
              <span>{service.name}</span>
              <i aria-hidden="true" />
              <b>{service.price != null ? t('{price} dan', { price: formatMoney(service.price) }) : t('Kelishiladi')}</b>
            </li>
          ))}
        </ul>
      )}
      <a className="gm-pub__master-cta" href={env.customerUrl}>{t('Bog‘lanish uchun ro‘yxatdan o‘ting')}</a>
    </article>
  );
}
