import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Award, BadgeCheck, Briefcase, CalendarClock, ImageIcon, MapPin, Power, ShieldCheck, Smartphone, Star, UserRound, Wrench } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { accountName } from '@/lib/account-name';
import { formatDate } from '@/lib/utils';
import { statusLabel } from '@/lib/labels';
import { useMe } from '@/features/session/hooks/useMe';
import { useMyMasterProfile } from '@/features/master/hooks/useMaster';
import { MasterForm } from '@/features/master/components/MasterForm';
import { MasterStatusPanel } from '@/features/master/components/MasterStatusPanel';
import { ServiceList } from '@/features/service/components/ServiceList';
import { ServiceForm } from '@/features/service/components/ServiceForm';
import { TrustProfile } from '@/features/trust/components/TrustProfile';
import { TrustBadge } from '@/features/trust/components/TrustBadge';
import { FOCUS_VERIFICATION_EVENT } from '@/features/trust/components/VerificationBanner';
import { ProfileHero } from '@/features/profile/ProfileHero';
import { InfoRows, ProfileCard } from '@/features/profile/ProfileCard';
import '@/features/profile/Profile.css';

const STATUS_TONE = { ACTIVE: 'success', INACTIVE: 'neutral', BUSY: 'warning', RESTRICTED: 'danger', SUSPENDED: 'danger' } as const;
const percent = (value: string | number | undefined) => `${Math.round(Number(value ?? 0))}%`;

export function MasterProfilePage() {
  const profile = useMyMasterProfile();
  const me = useMe();
  const { hash } = useLocation();
  const loaded = !profile.isLoading;
  const [highlightVerification, setHighlightVerification] = useState(false);

  const focusVerification = useCallback(() => {
    document.getElementById('tasdiqlash')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightVerification(false);
    window.requestAnimationFrame(() => setHighlightVerification(true));
  }, []);

  useEffect(() => {
    if (loaded && hash === '#tasdiqlash') focusVerification();
  }, [loaded, hash, focusVerification]);

  useEffect(() => {
    window.addEventListener(FOCUS_VERIFICATION_EVENT, focusVerification);
    return () => window.removeEventListener(FOCUS_VERIFICATION_EVENT, focusVerification);
  }, [focusVerification]);

  useEffect(() => {
    if (!highlightVerification) return;
    const timer = window.setTimeout(() => setHighlightVerification(false), 3000);
    return () => window.clearTimeout(timer);
  }, [highlightVerification]);

  if (profile.isLoading) return <PageLoader label="Profil yuklanmoqda…" />;

  const data = profile.data ?? null;
  const user = me.data;
  const name = accountName(user);
  const areas = data?.serviceAreas ?? [];
  const verified = data?.verification === 'VERIFIED';
  const workState = !data
    ? statusLabel(user?.status ?? 'ACTIVE')
    : !verified
      ? 'Nofaol — admin tasdig‘i kutilmoqda'
      : data.isPaused
        ? 'Pauzada'
        : statusLabel(data.status);
  const radius = data?.workRadiusKm ? `${Number(data.workRadiusKm)} km` : '—';

  return (
    <div className="gm-ppage">
      <div className="gm-page-header" style={{ marginBottom: 0 }}>
        <h1>Usta profili</h1>
      </div>

      {data && user ? (
        <ProfileHero
          name={name}
          seed={user.id}
          accountNumber={user.accountNumber}
          subtitle={data.profession ?? 'Kasb ko‘rsatilmagan'}
          badges={
            <>
              <Badge tone="primary">Usta</Badge>
              <TrustBadge verification={data.verification} />
              <Badge tone={data.isPaused ? 'warning' : STATUS_TONE[data.status]}>{data.isPaused ? 'Pauzada' : statusLabel(data.status)}</Badge>
            </>
          }
          stats={[
            { icon: Star, label: 'Reyting', value: Number(data.ratingAvg).toFixed(1), hint: `${data.ratingCount} ta sharh` },
            { icon: Award, label: 'Bajarilgan ishlar', value: data.completedOrders },
            { icon: CalendarClock, label: 'Tajriba', value: data.experienceYears ? `${data.experienceYears} yil` : '—' },
            { icon: BadgeCheck, label: 'Ishonchlilik', value: percent(data.completionRate), hint: 'yakunlash' },
          ]}
        />
      ) : null}

      <div className="gm-pgrid">
        <div className="gm-pcol">
          <ProfileCard icon={UserRound} title={data ? 'Shaxsiy va kasbiy ma’lumotlar' : 'Usta profilini yarating'} hint="Ism, kasb, tajriba va ish hududi mijozlarga ko‘rinadi.">
            <MasterForm key={data?.id ?? 'new'} profile={data} />
          </ProfileCard>
          {data && (
            <ProfileCard defaultOpen icon={Power} title="Ish holati" hint="Faol bo‘lsangiz mijozlar sizni topadi va takliflar keladi.">
              <MasterStatusPanel profile={data} />
            </ProfileCard>
          )}
        </div>

        <div className="gm-pcol">
          {user && (
            <ProfileCard icon={Smartphone} title="Akkaunt ma’lumotlari">
              <InfoRows
                rows={[
                  { label: 'Akkaunt ID', value: user.accountNumber },
                  { label: 'Telefon', value: user.phone },
                  { label: 'Email', value: user.email ?? '—' },
                  { label: 'Telefon tasdiqlangan', value: user.phoneVerifiedAt ? 'Ha' : 'Yo‘q' },
                  { label: 'Holat', value: workState },
                  { label: 'Ro‘yxatdan o‘tgan', value: user.createdAt ? formatDate(user.createdAt) : '—' },
                ]}
              />
            </ProfileCard>
          )}
          {data && (
            <>
              <ProfileCard icon={Briefcase} title="Kasbiy ko‘rsatkichlar">
                <InfoRows
                  rows={[
                    { label: 'Kasb', value: data.profession ?? '—' },
                    { label: 'Tajriba', value: data.experienceYears ? `${data.experienceYears} yil` : '—' },
                    { label: 'Bajarilgan ishlar', value: data.completedOrders },
                    { label: 'Yakunlash ko‘rsatkichi', value: percent(data.completionRate) },
                    { label: 'Javob berish', value: percent(data.responseRate) },
                    { label: 'A’zo bo‘lgan', value: formatDate(data.createdAt) },
                  ]}
                />
                {data.bio && <p className="gm-card__meta" style={{ margin: 0 }}>{data.bio}</p>}
              </ProfileCard>
              <ProfileCard icon={MapPin} title="Ish hududi">
                <InfoRows rows={[{ label: 'Ish radiusi', value: radius }]} />
                {areas.length > 0 ? (
                  <ul className="gm-ptags">
                    {areas.map((area) => (
                      <li key={area}>{area}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="gm-card__meta" style={{ margin: 0 }}>Hududlar kiritilmagan.</p>
                )}
              </ProfileCard>
              <ProfileCard icon={ImageIcon} title="Portfolio" hint="Ish namunalari admin tasdiqlagach ko‘rinadi.">
                <Link to="/ustalar/portfolio">
                  <Button variant="secondary" size="sm">Portfolioni boshqarish</Button>
                </Link>
              </ProfileCard>
            </>
          )}
        </div>
      </div>

      {data && (
        <div className="gm-pgrid">
          <ProfileCard icon={Wrench} title="Xizmatlarim" hint="Shu xizmatlar bo‘yicha so‘rovlar sizga keladi.">
            <ServiceList />
            <ServiceForm />
          </ProfileCard>
          <ProfileCard icon={ShieldCheck} title="Tasdiqlash (verification)" hint="Tasdiqlangan ustalar ko‘proq ishonch qozonadi." id="tasdiqlash" highlight={highlightVerification}>
            <TrustProfile masterId={data.id} />
          </ProfileCard>
        </div>
      )}
    </div>
  );
}
