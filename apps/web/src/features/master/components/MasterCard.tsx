import { accountName } from '@/lib/account-name';
import { Link } from 'react-router-dom';
import { BadgeCheck, Briefcase, MessageCircle, Star, Wrench } from 'lucide-react';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { formatMoney } from '@/lib/utils';
import type { PublicMaster } from '../types';
import { t } from '@/i18n';

const MAX_TAGS = 3;

export function MasterCard({ master }: { master: PublicMaster }) {
  const name = accountName(master.user);
  const rating = Number(master.ratingAvg);
  const services = master.services ?? [];
  const prices = services.map((item) => Number(item.basePrice)).filter((price) => price > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;

  return (
    <Link to={`/ustalar-katalogi/${master.user.accountNumber ?? master.id}`} className="gm-master">
      <div className="gm-master__top">
        <ChatAvatar name={name} seed={master.id} size="lg" />
        <div className="gm-master__id">
          <h3 className="gm-master__name">
            {name}
            {master.verification === 'VERIFIED' && (
              <BadgeCheck size={18} className="gm-master__verified" aria-label={t('Tasdiqlangan usta')} />
            )}
          </h3>
          <p className="gm-master__profession">{master.profession ?? t('Kasb ko‘rsatilmagan')}</p>
          {master.workPlace && <p className="gm-master__profession">{master.workPlace}</p>}
        </div>
        {master.user.accountNumber !== undefined && <span className="gm-master__num">ID {master.user.accountNumber}</span>}
      </div>

      <div className="gm-master__stats">
        <span className="gm-master__stat" title={t('{ratingCount} ta sharh', { ratingCount: master.ratingCount })}>
          <Star size={15} className="gm-master__star" fill="currentColor" />
          <strong>{master.ratingCount > 0 ? rating.toFixed(1) : t('Yangi')}</strong>
          {master.ratingCount > 0 && <small>({master.ratingCount})</small>}
        </span>
        <span className="gm-master__stat">
          <Briefcase size={15} />
          <strong>{master.completedOrders}</strong>
          <small>buyurtma</small>
        </span>
        {master.experienceYears ? (
          <span className="gm-master__stat">
            <Wrench size={15} />
            <strong>{master.experienceYears}</strong>
            <small>{t('yil tajriba')}</small>
          </span>
        ) : null}
      </div>

      {services.length > 0 && (
        <ul className="gm-master__tags" aria-label={t('Xizmatlar')}>
          {services.slice(0, MAX_TAGS).map((item) => (
            <li key={item.serviceId}>{item.service.name}</li>
          ))}
          {services.length > MAX_TAGS && <li className="gm-master__more">+{services.length - MAX_TAGS}</li>}
        </ul>
      )}

      <div className="gm-master__foot">
        <span className="gm-master__price">
          {minPrice !== null ? (
            <>
              <small>dan</small> <strong>{formatMoney(minPrice)}</strong>
            </>
          ) : (
            <small>{t('Narx kelishiladi')}</small>
          )}
        </span>
        <span className="gm-master__cta">
          <MessageCircle size={16} />{' '}{t('Batafsil')}</span>
      </div>
    </Link>
  );
}
