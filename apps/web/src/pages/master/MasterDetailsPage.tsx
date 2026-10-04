import { accountName } from '@/lib/account-name';
import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { Award, BadgeCheck, Briefcase, CalendarClock, MapPin, MessageCircle, Star } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { formatMoney, initials } from '@/lib/utils';
import { useMaster } from '@/features/master/hooks/useMaster';
import { useOpenMasterChat } from '@/features/communication/hooks/useCommunication';
import { TrustBadge } from '@/features/trust/components/TrustBadge';
import { CoverageDialog } from '@/features/geo/components/CoverageDialog';
import { CoverageMap } from '@/features/geo/components/CoverageMap';
import { ReviewList } from '@/features/review/components/ReviewList';
import { t } from '@/i18n';
import './MasterProfile.css';

export function MasterDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const master = useMaster(id);
  const openChat = useOpenMasterChat();
  const [areaOpen, setAreaOpen] = useState<string | null>(null);

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
            {data.workPlace && (
              <span className="gm-mp-hero__place">
                <Briefcase size={14} aria-hidden="true" /> {data.workPlace}
              </span>
            )}
          </div>
        </div>
      </section>

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

      <section className="gm-mp-section">
        <h2>{t('Sharhlar')}</h2>
        <ReviewList masterId={data.id} />
      </section>

      {/* 9 · Chaqiruv: sahifa oxirida (DOM da oxirgi), skrollda pastda yopishib turadi */}
      <div className="gm-mp-cta gm-action-row">
        <Button
          size="lg"
          loading={openChat.isPending}
          onClick={() => openChat.mutate(data.id, { onSuccess: (conversation) => navigate(`/mijozlar/chat?suhbat=${conversation.id}`) })}
        >
          <MessageCircle size={20} />{' '}{t('Chat orqali bog‘lanish')}</Button>
        {openChat.isError && <Alert tone="danger">{getErrorMessage(openChat.error)}</Alert>}
      </div>
    </div>
  );
}
