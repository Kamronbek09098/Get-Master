import { accountName } from '@/lib/account-name';
import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { Award, BadgeCheck, Briefcase, CalendarClock, MapPin, MessageCircle, Star, Info, LayoutGrid, MessageSquareText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ReviewList } from '@/features/review/components/ReviewList';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { ProBadge } from '@/features/subscription/meta';
import { ModeBadges } from '@/features/service/ModeBadges';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate, formatMoney, initials } from '@/lib/utils';
import { useMaster } from '@/features/master/hooks/useMaster';
import { useOpenMasterChat } from '@/features/communication/hooks/useCommunication';
import { TrustBadge } from '@/features/trust/components/TrustBadge';
import { CoverageDialog } from '@/features/geo/components/CoverageDialog';
import { CoverageMap } from '@/features/geo/components/CoverageMap';
import { FavoriteButton } from '@/features/master/components/FavoriteButton';
import { PublicAvailability } from '@/features/master/components/PublicAvailability';
import { PublicPortfolio } from '@/features/master/components/PublicPortfolio';
import { CompletedJobs } from '@/features/master/components/CompletedJobs';
import { t } from '@/i18n';
import './MasterProfile.css';

type DetailTab = 'info' | 'works' | 'reviews';
const TABS: Array<{ id: DetailTab; icon: LucideIcon; label: () => string }> = [
  { id: 'info', icon: Info, label: () => t('Ma’lumot') },
  { id: 'works', icon: LayoutGrid, label: () => t('Ishlar') },
  { id: 'reviews', icon: MessageSquareText, label: () => t('Sharhlar') },
];

export function MasterDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const master = useMaster(id);
  const openChat = useOpenMasterChat();
  const [areaOpen, setAreaOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>('info');

  if (master.isLoading) return <PageLoader label={t('Usta yuklanmoqda…')} />;
  if (master.isError) return <Alert tone="danger">{getErrorMessage(master.error)}</Alert>;
  if (!master.data) return null;

  const data = master.data;
  const name = accountName(data.user);

  const services = data.services ?? [];
  const verified = data.verification === 'VERIFIED';

  return (
    <div className="gm-mp">
      {/* 1 · Hero + 2 · Shaxs */}
      <section className="gm-mp-hero" aria-labelledby="gm-mp-name">
        <span className="gm-mp-hero__avatar" aria-hidden="true">
          {initials(name)}
        </span>
        <div className="gm-mp-hero__who">
          <p className="gm-mp-hero__kicker">{data.profession ?? t('Kasb ko‘rsatilmagan')}</p>
          <h1 id="gm-mp-name">{name}</h1>
          <div className="gm-mp-hero__badges">
            <TrustBadge verification={data.verification} />
            {data.isPro && <ProBadge />}
            {data.isPaused && <Badge tone="warning">{t('Pauzada')}</Badge>}
            <FavoriteButton masterId={data.id} />
            <ModeBadges modes={data.serviceModes} />
            {data.regionName && (
              <span className="gm-mp-hero__place">
                <MapPin size={14} aria-hidden="true" /> {data.regionName}
              </span>
            )}
            {data.serviceModes?.includes('AT_MASTER') && data.placeAddress && (
              <span className="gm-mp-hero__place">
                <MapPin size={14} aria-hidden="true" /> {data.placeAddress}
              </span>
            )}
            {data.workPlace && (
              <span className="gm-mp-hero__place">
                <Briefcase size={14} aria-hidden="true" /> {data.workPlace}
              </span>
            )}
          </div>
        </div>
      </section>

      {data.isPaused && (
        <Alert tone="warning" title={t('Usta hozircha buyurtma qabul qilmayapti')}>
          {data.pausedUntil
            ? t('{date} dan keyin qaytadi. Hozir unga chat orqali yozib qo‘yishingiz mumkin.', { date: formatDate(data.pausedUntil) })
            : t('Usta qaytgach, siz bilan bog‘lanadi. Hozir unga chat orqali yozib qo‘yishingiz mumkin.')}
        </Alert>
      )}

      {/* 3 · Ishonch */}
      <section className="gm-mp-trust" aria-label={t('Ishonch ko‘rsatkichlari')}>
        <dl>
          <div>
            <dt>
              <Star size={15} aria-hidden="true" /> {t('Reyting')}
            </dt>
            <dd>
              {Number(data.ratingAvg).toFixed(1)} <small>{t('({ratingCount} ta sharh)', { ratingCount: data.ratingCount })}</small>
            </dd>
          </div>
          <div>
            <dt>
              <Award size={15} aria-hidden="true" /> {t('Bajarilgan ishlar')}
            </dt>
            <dd>{data.completedOrders}</dd>
          </div>
          <div>
            <dt>
              <CalendarClock size={15} aria-hidden="true" /> {t('Tajriba')}
            </dt>
            <dd>{data.experienceYears ? `${data.experienceYears} yil` : '—'}</dd>
          </div>
          <div className={verified ? 'is-ok' : undefined}>
            <dt>
              <BadgeCheck size={15} aria-hidden="true" /> {t('Shaxsi')}
            </dt>
            <dd>{verified ? t('Tasdiqlangan') : t('Tasdiqlanmagan')}</dd>
          </div>
        </dl>
      </section>

      <div className="gm-mp-tabs" role="tablist" aria-label={t('Usta ma’lumotlari')}>
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'is-active' : undefined} onClick={() => setTab(item.id)}>
            <item.icon size={18} aria-hidden="true" /> {item.label()}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <>
      {/* 4 · Mutaxassislik */}
      {data.bio && (
        <section className="gm-mp-section">
          <h2>{t('Mutaxassislik')}</h2>
          <p className="gm-mp-bio">{data.bio}</p>
        </section>
      )}

      {/* 5 · Xizmatlar */}
      {services.length > 0 && (
        <section className="gm-mp-section">
          <h2>{t('Xizmatlar')}</h2>
          <ul className="gm-mp-services">
            {services.map((item) => (
              <li key={item.serviceId}>
                <span>{item.service.name}</span>
                <strong>
                  {t('dan')} {formatMoney(item.basePrice)}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PublicAvailability masterId={data.id} />

      {data.coverage && (
        <section className="gm-mp-section">
          <h2>{t('Ish hududi')}</h2>
          <p className="gm-card__meta" style={{ marginTop: 0 }}>{t('Usta markazdan')}{' '}<strong>{data.coverage.radiusKm} km</strong>{' '}{t('masofagacha bo‘lgan manzillarga keladi. Hududni bossangiz, xaritada to‘liq ochiladi.')}</p>
          {(data.serviceAreas ?? []).length > 0 && (
            <ul className="gm-ptags" aria-label={t('Ish hududlari')}>
              {(data.serviceAreas ?? []).map((area) => (
                <li key={area}>
                  <button type="button" className="gm-ptags__btn" onClick={() => setAreaOpen(area)} aria-label={t('{area} — xaritada ochish', { area })}>
                    <MapPin size={13} aria-hidden="true" /> {area}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div style={{ marginTop: 12 }}>
            <CoverageMap latitude={data.coverage.lat} longitude={data.coverage.lon} radiusKm={data.coverage.radiusKm} height={260} />
          </div>
          <div className="gm-action-row" style={{ marginTop: 12 }}>
            <Button variant="secondary" size="sm" onClick={() => setAreaOpen('')}>
              <MapPin size={15} />{' '}{t('Xaritada kattalashtirish')}</Button>
          </div>
          <CoverageDialog
            open={areaOpen !== null}
            onClose={() => setAreaOpen(null)}
            title={t('{name} — ish hududi', { name })}
            area={areaOpen || null}
            areas={data.serviceAreas ?? []}
            lat={data.coverage.lat}
            lon={data.coverage.lon}
            radiusKm={data.coverage.radiusKm}
            approximate
          />
        </section>
      )}

        </>
      )}
      {tab === 'works' && (
        <>
      {(data.portfolio ?? []).length > 0 && (
        <section className="gm-mp-section">
          <h2>{t('Portfolio')}</h2>
          <PublicPortfolio items={data.portfolio ?? []} />
        </section>
      )}

      <CompletedJobs masterId={data.id} completedOrders={data.completedOrders} />
        </>
      )}
      {tab === 'reviews' && (
        <section className="gm-mp-section">
          <h2>{t('Sharhlar')}</h2>
          <ReviewList masterId={data.id} />
        </section>
      )}

      {/* 9 · Chaqiruv: sahifa oxirida (DOM da oxirgi), skrollda pastda yopishib turadi */}
      <div className="gm-mp-cta gm-action-row">
        <Button
          size="lg"
          loading={openChat.isPending}
          onClick={() => openChat.mutate(data.id, { onSuccess: (conversation) => navigate(`/mijoz/chat?suhbat=${conversation.id}`) })}
        >
          <MessageCircle size={20} />{' '}{t('Usta bilan bog‘lanish')}</Button>
        {openChat.isError && <Alert tone="danger">{getErrorMessage(openChat.error)}</Alert>}
      </div>
    </div>
  );
}
