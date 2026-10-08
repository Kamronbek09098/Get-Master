import { CalendarClock, CheckCircle2, Clock, EyeOff, Timer, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useCountdown } from '@/hooks/useCountdown';
import { formatCountdown, formatDateTime, formatMoney, formatRelativeTime } from '@/lib/utils';
import { MediaViewer } from '@/features/media/components/MediaViewer';
import { OfferBadge } from './OfferBadge';
import type { OpenRequest } from '../types';
import './OpenRequestCard.css';
import { t } from '@/i18n';

function Countdown({ expiresAt }: { expiresAt: string | null }) {
  const remaining = useCountdown(expiresAt);
  if (remaining === null) return null;
  const expired = remaining <= 0;
  const soon = !expired && remaining < 60 * 60_000;
  return (
    <Badge tone={expired ? 'danger' : soon ? 'warning' : 'neutral'}>
      <Timer size={14} /> {formatCountdown(remaining)}
    </Badge>
  );
}

/** Ustaga ko‘rinadigan ochiq so‘rov kartasi: aniq qatorlar, mijoz rasmlari va asosiy harakat tugmalari. */
export function OpenRequestCard({ request, onAccept, onSkip }: { request: OpenRequest; onAccept: () => void; onSkip: () => void }) {
  const photos = request.photos ?? [];
  const more = Math.max((request.photosCount ?? photos.length) - photos.length, 0);
  const place = [request.area, request.distanceKm != null ? `${request.distanceKm.toFixed(1).replace('.', ',')} km` : null].filter(Boolean).join(' · ');

  return (
    <article className="gm-orc">
      <header className="gm-orc__head">
        <span className="gm-orc__kicker">
          <i aria-hidden="true" /> {t('Yangi ish so‘rovi')}
        </span>
        <div className="gm-orc__badges">
          {request.notified && <Badge tone="primary">{t('Sizga yuborilgan')}</Badge>}
          {request.expiresAt && <Countdown expiresAt={request.expiresAt} />}
        </div>
      </header>

      <dl className="gm-orc__rows">
        {request.service && (
          <div>
            <dt>{t('Xizmat')}</dt>
            <dd>{request.service.name}</dd>
          </div>
        )}
        <div>
          <dt>{t('Muammo')}</dt>
          <dd>{request.title}</dd>
        </div>
        {place && (
          <div>
            <dt>{t('Joy')}</dt>
            <dd>{place}</dd>
          </div>
        )}
        {request.customerName && (
          <div>
            <dt>{t('Mijoz')}</dt>
            <dd>{request.customerName}</dd>
          </div>
        )}
        <div>
          <dt>{t('Qulay vaqt')}</dt>
          <dd>{request.preferredStartAt ? formatDateTime(request.preferredStartAt) : t('Kelishiladi')}</dd>
        </div>
      </dl>

      {request.description && <p className="gm-orc__text">{request.description}</p>}

      {photos.length > 0 && (
        <ul className={`gm-orc__photos gm-orc__photos--${Math.min(photos.length, 4)}`} aria-label={t('Mijoz biriktirgan rasmlar')}>
          {photos.map((id, index) => (
            <li key={id}>
              <MediaViewer assetId={id} alt={t('Muammo rasmi {n}', { n: index + 1 })} label={t('Muammo rasmi {n}', { n: index + 1 })} />
              {index === photos.length - 1 && more > 0 && <span className="gm-orc__more">+{more}</span>}
            </li>
          ))}
        </ul>
      )}

      <p className="gm-orc__meta">
        <span>
          <Users size={14} aria-hidden="true" /> {t('Takliflar: {offersCount}', { offersCount: request.offersCount })}
        </span>
        <span>
          <Clock size={14} aria-hidden="true" /> {formatRelativeTime(request.createdAt)}
        </span>
        {request.expiresAt && (
          <span>
            <CalendarClock size={14} aria-hidden="true" /> {t('Taklif muddati:')} {formatDateTime(request.expiresAt)}
          </span>
        )}
      </p>

      {request.myOffer ? (
        <div className="gm-orc__mine">
          <OfferBadge status={request.myOffer.status} />
          <span>{t('Sizning taklifingiz: {money}', { money: formatMoney(request.myOffer.price) })}</span>
        </div>
      ) : (
        <div className="gm-orc__actions">
          <Button size="lg" onClick={onAccept}>
            <CheckCircle2 size={18} /> {t('Taklif berish')}
          </Button>
          <Button size="lg" variant="secondary" onClick={onSkip}>
            <EyeOff size={17} /> {t('O‘tkazib yuborish')}
          </Button>
        </div>
      )}
    </article>
  );
}
