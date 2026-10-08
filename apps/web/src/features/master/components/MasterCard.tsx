import { Link } from 'react-router-dom';
import { BadgeCheck, ChevronRight, Clock, MapPin, Star } from 'lucide-react';
import { accountName } from '@/lib/account-name';
import { MediaThumbnail } from '@/features/media/components/MediaThumbnail';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { formatMoney } from '@/lib/utils';
import { ProBadge } from '@/features/subscription/meta';
import { ModeBadges } from '@/features/service/ModeBadges';
import type { PublicMaster } from '../types';
import { t } from '@/i18n';

const MAX_TAGS = 3;
const WEEKDAYS = () => [t('Yakshanba'), t('Dushanba'), t('Seshanba'), t('Chorshanba'), t('Payshanba'), t('Juma'), t('Shanba')];

/** «Ism F.» ko‘rinishi: karta ixcham, to‘liq ism profil sahifasida. */
function shortName(master: PublicMaster): string {
  const first = master.user.firstName?.trim();
  const last = master.user.lastName?.trim();
  if (!first) return accountName(master.user);
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

/** «Bugun 14:00 dan bo‘sh» / «Hozir bo‘sh» / «Ertaga 09:00 dan bo‘sh» / «Juma 10:00 dan bo‘sh». */
function availabilityText(next: NonNullable<PublicMaster['nextAvailable']>): string {
  if (next.now) return t('Hozir bo‘sh');
  if (next.dayOffset === 0) return t('Bugun {time} dan bo‘sh', { time: next.time });
  if (next.dayOffset === 1) return t('Ertaga {time} dan bo‘sh', { time: next.time });
  const day = WEEKDAYS()[(new Date(Date.now() + 5 * 3_600_000).getUTCDay() + next.dayOffset) % 7] ?? '';
  return t('{day} {time} dan bo‘sh', { day, time: next.time });
}

export function MasterCard({ master }: { master: PublicMaster }) {
  const fullName = accountName(master.user);
  const rating = Number(master.ratingAvg);
  const services = master.services ?? [];
  const prices = services.map((item) => Number(item.basePrice)).filter((price) => price > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const photos = (master.portfolio ?? []).filter((item) => item.mediaAssetId).slice(0, 3);
  const response = master.responseRate != null ? Math.round(Number(master.responseRate)) : null;

  return (
    <Link to={`/mijoz/ustalar/${master.user.accountNumber ?? master.id}`} className="gm-master" aria-label={fullName}>
      <div className="gm-master__top">
        <ChatAvatar name={fullName} seed={master.id} size="lg" />
        <div className="gm-master__id">
          <h3 className="gm-master__name">
            {shortName(master)}
            {master.isPro && <ProBadge size="sm" />}
          </h3>
          <p className="gm-master__verify">
            {master.verification === 'VERIFIED' ? (
              <>
                <BadgeCheck size={15} aria-hidden="true" /> {t('Tasdiqlangan')}
              </>
            ) : (
              <span className="is-muted">{master.profession ?? t('Kasb ko‘rsatilmagan')}</span>
            )}
            {master.user.accountNumber !== undefined && <span className="gm-master__num">ID {master.user.accountNumber}</span>}
          </p>
        </div>
        <span className={master.ratingCount > 0 ? 'gm-master__rating' : 'gm-master__rating gm-master__rating--new'} title={t('{ratingCount} ta sharh', { ratingCount: master.ratingCount })}>
          {master.ratingCount > 0 ? (
            <>
              <Star size={14} fill="currentColor" aria-hidden="true" /> {rating.toFixed(1)}
            </>
          ) : (
            t('Yangi')
          )}
        </span>
      </div>

      <div className="gm-master__stats">
        <span className="gm-master__stat">
          <strong>{master.experienceYears ? master.experienceYears : '—'}</strong>
          <small>{t('yil tajriba')}</small>
        </span>
        <span className="gm-master__stat">
          <strong>{master.completedOrders}</strong>
          <small>{t('bajarilgan ish')}</small>
        </span>
        <span className="gm-master__stat">
          <strong>{response !== null && response > 0 ? `${response}%` : '—'}</strong>
          <small>{t('javob berish')}</small>
        </span>
      </div>

      <ModeBadges modes={master.serviceModes} size="sm" />
      {master.regionName && (
        <p className="gm-master__region"><MapPin size={13} aria-hidden="true" /> {master.regionName}</p>
      )}

      {(services.length > 0 || master.profession) && (
        <ul className="gm-master__tags" aria-label={t('Xizmatlar')}>
          {services.length > 0 ? (
            <>
              {services.slice(0, MAX_TAGS).map((item) => (
                <li key={item.serviceId}>{item.service.name}</li>
              ))}
              {services.length > MAX_TAGS && <li className="gm-master__more">+{services.length - MAX_TAGS}</li>}
            </>
          ) : (
            <li>{master.profession}</li>
          )}
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
        {master.nextAvailable ? (
          <span className={master.nextAvailable.now ? 'gm-master__free gm-master__free--now' : 'gm-master__free'}>
            <Clock size={15} aria-hidden="true" /> {availabilityText(master.nextAvailable)}
          </span>
        ) : (
          <span className="gm-master__price">{minPrice !== null ? <><small>dan</small> <strong>{formatMoney(minPrice)}</strong></> : <small>{t('Narx kelishiladi')}</small>}</span>
        )}
        <span className="gm-master__go" aria-hidden="true">
          <ChevronRight size={18} />
        </span>
      </div>
    </Link>
  );
}
