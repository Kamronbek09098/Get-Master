import { accountName } from '@/lib/account-name';
import { MediaThumbnail } from '@/features/media/components/MediaThumbnail';
import { Link } from 'react-router-dom';
import { BadgeCheck, MessageCircle, Star } from 'lucide-react';
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

  const photos = (master.portfolio ?? []).filter((item) => item.mediaAssetId).slice(0, 3);

  return (
    <Link to={`/mijoz/ustalar/${master.user.accountNumber ?? master.id}`} className="gm-master">
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
        </div>
        {master.user.accountNumber !== undefined && <span className="gm-master__num">ID {master.user.accountNumber}</span>}
      </div>

      <div className="gm-master__stats">
        <span className="gm-master__stat" title={t('{ratingCount} ta sharh', { ratingCount: master.ratingCount })}>
          <strong>
            <Star size={14} className="gm-master__star" fill="currentColor" />
            {master.ratingCount > 0 ? rating.toFixed(1) : t('Yangi')}
          </strong>
          <small>{master.ratingCount > 0 ? t('{ratingCount} ta sharh', { ratingCount: master.ratingCount }) : t('Reyting')}</small>
        </span>
        <span className="gm-master__stat">
          <strong>{master.completedOrders}</strong>
          <small>{t('bajarilgan ish')}</small>
        </span>
        <span className="gm-master__stat">
          <strong>{master.experienceYears ? master.experienceYears : '—'}</strong>
          <small>{t('yil tajriba')}</small>
        </span>
      </div>

      {services.length > 0 && (
        <ul className="gm-master__tags" aria-label={t('Xizmatlar')}>
          {services.slice(0, MAX_TAGS).map((item) => (
            <li key={item.serviceId}>{item.service.name}</li>
          ))}
          {services.length > MAX_TAGS && <li className="gm-master__more">+{services.length - MAX_TAGS}</li>}
        </ul>
      )}

      {photos.length > 0 && (
        <div className="gm-master__photos" aria-hidden="true">
          {photos.map((item) => (
            <MediaThumbnail key={item.id} assetId={item.mediaAssetId as string} alt="" />
          ))}
        </div>
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
