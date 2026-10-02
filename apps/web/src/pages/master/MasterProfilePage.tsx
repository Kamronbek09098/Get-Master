import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Award, BadgeCheck, ChevronRight, Briefcase, CalendarClock, ImageIcon, MapPin, Power, ShieldCheck, Smartphone, Star, UserRound, Wrench } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Badge } from '@/components/ui/Badge';
import { accountName } from '@/lib/account-name';
import { formatDate } from '@/lib/utils';
import { statusLabel } from '@/lib/labels';
import { useMe } from '@/features/session/hooks/useMe';
import { useMyMasterProfile } from '@/features/master/hooks/useMaster';
import { MasterForm } from '@/features/master/components/MasterForm';
import { WorkAreaEditor } from '@/features/master/components/WorkAreaEditor';
import { MasterStatusPanel } from '@/features/master/components/MasterStatusPanel';
import { ServiceList } from '@/features/service/components/ServiceList';
import { ServiceForm } from '@/features/service/components/ServiceForm';
import { TrustProfile } from '@/features/trust/components/TrustProfile';
import { TrustBadge } from '@/features/trust/components/TrustBadge';
import { FOCUS_VERIFICATION_EVENT } from '@/features/trust/components/VerificationBanner';
import { ProfileHero } from '@/features/profile/ProfileHero';
import { InfoRows, ProfileCard } from '@/features/profile/ProfileCard';
import '@/features/profile/Profile.css';
import { t } from '@/i18n';

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

  if (profile.isLoading) return <PageLoader label={t('Profil yuklanmoqda…')} />;

  const data = profile.data ?? null;
  const user = me.data;
  const name = accountName(user);
  const verified = data?.verification === 'VERIFIED';
  const workState = !data
    ? statusLabel(user?.status ?? 'ACTIVE')
    : !verified
      ? t('Nofaol — admin tasdig‘i kutilmoqda')
      : data.isPaused
        ? 'Pauzada'
        : statusLabel(data.status);

  return (
    <div className="gm-ppage">
      <div className="gm-page-header" style={{ marginBottom: 0 }}>
        <h1>{t('Usta profili')}</h1>
      </div>

      {data && user ? (
        <ProfileHero
          name={name}
          seed={user.id}
          accountNumber={user.accountNumber}
          subtitle={data.profession ?? t('Kasb ko‘rsatilmagan')}
          badges={
            <>
              <Badge tone="primary">{t('Usta')}</Badge>
              <TrustBadge verification={data.verification} />
              <Badge tone={data.isPaused ? 'warning' : STATUS_TONE[data.status]}>{data.isPaused ? t('Pauzada') : statusLabel(data.status)}</Badge>
            </>
          }
          stats={[
            { icon: Star, label: t('Reyting'), value: Number(data.ratingAvg).toFixed(1), hint: t('{ratingCount} ta sharh', { ratingCount: data.ratingCount }) },
            { icon: Award, label: t('Bajarilgan ishlar'), value: data.completedOrders },
            { icon: CalendarClock, label: t('Tajriba'), value: data.experienceYears ? `${data.experienceYears} yil` : '—' },
            { icon: BadgeCheck, label: t('Ishonchlilik'), value: percent(data.completionRate), hint: 'yakunlash' },
          ]}
        />
      ) : null}

      <div className="gm-pmasonry">
        <ProfileCard icon={UserRound} title={data ? t('Shaxsiy va kasbiy ma’lumotlar') : t('Usta profilini yarating')} hint={t('Ism, kasb, tajriba va ish hududi mijozlarga ko‘rinadi.')}>
          <MasterForm key={data?.id ?? 'new'} profile={data} />
        </ProfileCard>

        {data && (
          <ProfileCard defaultOpen icon={Power} title={t('Ish holati')} hint={t('Faol bo‘lsangiz mijozlar sizni topadi va takliflar keladi.')}>
            <MasterStatusPanel profile={data} />
          </ProfileCard>
        )}

        {data && (
          <ProfileCard icon={Wrench} title={t('Xizmatlarim')} hint={t('Shu xizmatlar bo‘yicha so‘rovlar sizga keladi.')}>
            <ServiceList />
            <ServiceForm />
          </ProfileCard>
        )}

        {data && (
          <ProfileCard icon={ShieldCheck} title={t('Tasdiqlash (verification)')} hint={t('Tasdiqlangan ustalar ko‘proq ishonch qozonadi.')} id="tasdiqlash" highlight={highlightVerification}>
            <TrustProfile masterId={data.id} />
          </ProfileCard>
        )}

        {data && (
          <ProfileCard icon={MapPin} title={t('Ish hududi')} hint={t('Ish markazi, radius va hududlaringiz — mijozlar shu bo‘yicha sizni topadi.')}>
            <WorkAreaEditor profile={data} />
          </ProfileCard>
        )}

        {user && (
          <ProfileCard icon={Smartphone} title={t('Akkaunt ma’lumotlari')}>
            <InfoRows
              rows={[
                { label: t('Akkaunt ID'), value: `#${user.accountNumber}` },
                { label: t('Telefon'), value: user.phone },
                { label: t('Email'), value: user.email ?? <span className="gm-pmuted">{t('Kiritilmagan')}</span> },
                { label: t('Telefon tasdiqlangan'), value: <Badge tone={user.phoneVerifiedAt ? 'success' : 'warning'}>{user.phoneVerifiedAt ? 'Ha' : t('Yo‘q')}</Badge> },
                { label: t('Holat'), value: workState },
                { label: t('Ro‘yxatdan o‘tgan'), value: user.createdAt ? formatDate(user.createdAt) : '—' },
              ]}
            />
          </ProfileCard>
        )}

        {data && (
          <ProfileCard icon={Briefcase} title={t('Kasbiy ko‘rsatkichlar')}>
            <InfoRows
              rows={[
                { label: t('Kasb'), value: data.profession ?? '—' },
                { label: t('Tajriba'), value: data.experienceYears ? `${data.experienceYears} yil` : '—' },
                { label: t('Bajarilgan ishlar'), value: data.completedOrders },
                { label: t('Yakunlash ko‘rsatkichi'), value: percent(data.completionRate) },
                { label: t('Javob berish'), value: percent(data.responseRate) },
                { label: t('A’zo bo‘lgan'), value: formatDate(data.createdAt) },
              ]}
            />
            {data.bio && <p className="gm-card__meta" style={{ margin: 0 }}>{data.bio}</p>}
          </ProfileCard>
        )}

        {data && (
          <ProfileCard icon={ImageIcon} title={t('Portfolio')} hint={t('Ish namunalari admin tasdiqlagach ko‘rinadi.')}>
            <Link to="/ustalar/portfolio" className="gm-plink">
              <span className="gm-plink__icon" aria-hidden="true">
                <ImageIcon size={18} />
              </span>
              <span className="gm-plink__label">{t('Portfolioni boshqarish')}</span>
              <ChevronRight size={18} className="gm-plink__arrow" aria-hidden="true" />
            </Link>
          </ProfileCard>
        )}
      </div>
    </div>
  );
}
