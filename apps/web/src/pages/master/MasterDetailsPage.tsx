import { accountName } from '@/lib/account-name';
import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { Award, CalendarClock, MapPin, MessageCircle, Star } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { initials } from '@/lib/utils';
import { useMaster } from '@/features/master/hooks/useMaster';
import { useOpenMasterChat } from '@/features/communication/hooks/useCommunication';
import { TrustBadge } from '@/features/trust/components/TrustBadge';
import { CoverageDialog } from '@/features/geo/components/CoverageDialog';
import { CoverageMap } from '@/features/geo/components/CoverageMap';
import { ReviewList } from '@/features/review/components/ReviewList';

export function MasterDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const master = useMaster(id);
  const openChat = useOpenMasterChat();
  const [areaOpen, setAreaOpen] = useState<string | null>(null);

  if (master.isLoading) return <PageLoader label="Usta yuklanmoqda…" />;
  if (master.isError) return <Alert tone="danger">{getErrorMessage(master.error)}</Alert>;
  if (!master.data) return null;

  const data = master.data;
  const name = accountName(data.user);

  return (
    <div>
      <section className="gm-profile-hero">
        <div className="gm-profile-hero__top">
          <span className="gm-avatar gm-avatar--lg" aria-hidden="true">
            {initials(name)}
          </span>
          <div className="gm-profile-hero__who">
            <h1>{name}</h1>
            <p>{data.profession ?? 'Kasb ko‘rsatilmagan'}</p>
            <div className="gm-profile-hero__badges">
              <TrustBadge verification={data.verification} />
            </div>
          </div>
        </div>

        <dl className="gm-profile-hero__stats">
          <div>
            <dt>
              <Star size={15} /> Reyting
            </dt>
            <dd>
              {Number(data.ratingAvg).toFixed(1)} <small>({data.ratingCount} ta sharh)</small>
            </dd>
          </div>
          <div>
            <dt>
              <Award size={15} /> Bajarilgan ishlar
            </dt>
            <dd>{data.completedOrders}</dd>
          </div>
          <div>
            <dt>
              <CalendarClock size={15} /> Tajriba
            </dt>
            <dd>{data.experienceYears ? `${data.experienceYears} yil` : '—'}</dd>
          </div>
        </dl>

        {data.bio && <p className="gm-profile-hero__bio">{data.bio}</p>}

        <div className="gm-action-row">
          <Button
            size="lg"
            loading={openChat.isPending}
            onClick={() => openChat.mutate(data.id, { onSuccess: (conversation) => navigate(`/mijozlar/chat?suhbat=${conversation.id}`) })}
          >
            <MessageCircle size={20} /> Chat orqali bog‘lanish
          </Button>
        </div>
        {openChat.isError && <Alert tone="danger">{getErrorMessage(openChat.error)}</Alert>}
      </section>

      {data.coverage && (
        <section className="gm-detail-section">
          <h2>Ish hududi</h2>
          <p className="gm-card__meta" style={{ marginTop: 0 }}>
            Usta markazdan <strong>{data.coverage.radiusKm} km</strong> masofagacha bo‘lgan manzillarga keladi. Hududni bossangiz, xaritada to‘liq ochiladi.
          </p>
          {(data.serviceAreas ?? []).length > 0 && (
            <ul className="gm-ptags" aria-label="Ish hududlari">
              {(data.serviceAreas ?? []).map((area) => (
                <li key={area}>
                  <button type="button" className="gm-ptags__btn" onClick={() => setAreaOpen(area)} aria-label={`${area} — xaritada ochish`}>
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
              <MapPin size={15} /> Xaritada kattalashtirish
            </Button>
          </div>
          <CoverageDialog
            open={areaOpen !== null}
            onClose={() => setAreaOpen(null)}
            title={`${name} — ish hududi`}
            area={areaOpen || null}
            areas={data.serviceAreas ?? []}
            lat={data.coverage.lat}
            lon={data.coverage.lon}
            radiusKm={data.coverage.radiusKm}
            approximate
          />
        </section>
      )}

      <section className="gm-detail-section">
        <h2>Sharhlar</h2>
        <ReviewList masterId={data.id} />
      </section>
    </div>
  );
}
