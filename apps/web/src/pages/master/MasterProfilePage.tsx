import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Award, BadgeCheck, CalendarClock, LogOut, MapPin, MessageCircle, Power, Settings, ShieldCheck, Smartphone, Star, UserRound, Wrench } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Badge } from '@/components/ui/Badge';
import { accountName } from '@/lib/account-name';
import { formatDate } from '@/lib/utils';
import { statusLabel } from '@/lib/labels';
import { AvatarEditor } from '@/features/profile/AvatarEditor';
import { useMe } from '@/features/session/hooks/useMe';
import { useMyMasterProfile } from '@/features/master/hooks/useMaster';
import { MasterForm } from '@/features/master/components/MasterForm';
import { WorkAreaEditor } from '@/features/master/components/WorkAreaEditor';
import { ServiceModeEditor } from '@/features/master/components/ServiceModeEditor';
import '@/features/master/components/ServiceModeEditor.css';
import { MasterStatusPanel } from '@/features/master/components/MasterStatusPanel';
import { ServiceList } from '@/features/service/components/ServiceList';
import { ServiceForm } from '@/features/service/components/ServiceForm';
import { TrustProfile } from '@/features/trust/components/TrustProfile';
import { TrustBadge } from '@/features/trust/components/TrustBadge';
import { FOCUS_VERIFICATION_EVENT } from '@/features/trust/components/VerificationBanner';
import { LogoutDialog } from '@/features/auth/components/LogoutDialog';
import { InfoRows, ProfileCard } from '@/features/profile/ProfileCard';
import { ProfileMenuList, ProfileSubPage } from '@/features/profile/ProfileMenu';
import { GoogleLinkSettings } from '@/features/session/components/GoogleLinkSettings';
import '@/features/profile/Profile.css';
import './MasterOwnProfile.css';
import { t } from '@/i18n';

const BASE = '/usta/profil';
const STATUS_TONE = { ACTIVE: 'success', INACTIVE: 'neutral', BUSY: 'warning', RESTRICTED: 'danger', SUSPENDED: 'danger' } as const;
const percent = (value: string | number | undefined) => `${Math.round(Number(value ?? 0))}%`;

/** Usta profili: asosiy sahifada menyu, har bir qator — alohida ichki bo‘lim (ilova uslubi). */
export function MasterProfilePage() {
  const { section } = useParams();
  const profile = useMyMasterProfile();
  const me = useMe();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const navigate = useNavigate();
  const { hash } = useLocation();
  const loaded = !profile.isLoading;

  // «Hujjat yuborish» havolasi (#tasdiqlash yoki voqea) — tasdiqlash bo‘limini ochadi.
  useEffect(() => {
    if (loaded && hash === '#tasdiqlash') navigate(`${BASE}/tasdiqlash`, { replace: true });
  }, [loaded, hash, navigate]);
  useEffect(() => {
    const open = () => navigate(`${BASE}/tasdiqlash`);
    window.addEventListener(FOCUS_VERIFICATION_EVENT, open);
    return () => window.removeEventListener(FOCUS_VERIFICATION_EVENT, open);
  }, [navigate]);

  if (profile.isLoading) return <PageLoader label={t('Profil yuklanmoqda…')} />;

  const data = profile.data ?? null;
  const user = me.data;
  const name = accountName(user);

  // Profil hali yaratilmagan: faqat yaratish formasi.
  if (!data) {
    return (
      <div className="gm-pmenu-page">
        <div className="gm-page-header" style={{ marginBottom: 0 }}>
          <h1>{t('Usta profili')}</h1>
        </div>
        <ProfileCard defaultOpen icon={UserRound} title={t('Usta profilini yarating')} hint={t('Ism, kasb, tajriba va ish hududi mijozlarga ko‘rinadi.')}>
          <MasterForm key="new" profile={null} />
        </ProfileCard>
      </div>
    );
  }

  if (section === 'tahrirlash') {
    return (
      <ProfileSubPage title={t('Profilni tahrirlash')} backTo={BASE}>
        <div className="gm-mprof__mainform">
          <MasterForm key={data.id} profile={data} />
        </div>
        <div className="gm-pmerge__divider" />
        <GoogleLinkSettings />
      </ProfileSubPage>
    );
  }
  if (section === 'akkaunt' && user) {
    return (
      <ProfileSubPage title={t('Akkaunt ma’lumotlari')} backTo={BASE}>
        <InfoRows
          rows={[
            { label: t('Akkaunt ID'), value: `#${user.accountNumber}` },
            { label: t('Telefon'), value: user.phone },
            { label: t('Email'), value: user.email ?? <span className="gm-pmuted">{t('Kiritilmagan')}</span> },
            { label: t('Telefon tasdiqlangan'), value: <Badge tone={user.phoneVerifiedAt ? 'success' : 'warning'}>{user.phoneVerifiedAt ? 'Ha' : t('Yo‘q')}</Badge> },
            { label: t('Ro‘yxatdan o‘tgan'), value: user.createdAt ? formatDate(user.createdAt) : '—' },
          ]}
        />
      </ProfileSubPage>
    );
  }
  if (section === 'holat') {
    return (
      <ProfileSubPage title={t('Ish holati')} backTo={BASE}>
        <ProfileCard icon={Power} title={t('Ish holati')} hint={t('Faol bo‘lsangiz mijozlar sizni topadi va takliflar keladi.')}>
          <MasterStatusPanel profile={data} />
        </ProfileCard>
      </ProfileSubPage>
    );
  }
  if (section === 'xizmatlar') {
    return (
      <ProfileSubPage title={t('Xizmatlarim')} backTo={BASE}>
        <ProfileCard icon={Wrench} title={t('Xizmatlarim')} hint={t('Shu xizmatlar bo‘yicha so‘rovlar sizga keladi.')}>
          <ServiceList />
          <ServiceForm />
        </ProfileCard>
      </ProfileSubPage>
    );
  }
  if (section === 'tasdiqlash') {
    return (
      <ProfileSubPage title={t('Tasdiqlash')} backTo={BASE}>
        <ProfileCard icon={ShieldCheck} title={t('Tasdiqlash')} hint={t('Tasdiqlangan ustalar ko‘proq ishonch qozonadi.')} id="tasdiqlash">
          <TrustProfile masterId={data.id} />
        </ProfileCard>
      </ProfileSubPage>
    );
  }
  if (section === 'hudud') {
    return (
      <ProfileSubPage title={t('Ish hududi')} backTo={BASE}>
        <ProfileCard icon={MapPin} title={t('Ish hududi')} hint={t('Ish markazi, radius va hududlaringiz — mijozlar shu bo‘yicha sizni topadi.')}>
          <WorkAreaEditor profile={data} />
        </ProfileCard>
        <div className="gm-pmerge__divider" />
        <h3 className="gm-pmerge__title">{t('Ish rejimi')}</h3>
        <p className="gm-modeedit__lead">{t('Mijozning manzilida, o‘z joyingizda yoki ikkalasida ham ishlashingizni belgilang.')}</p>
        <ServiceModeEditor profile={data} />
      </ProfileSubPage>
    );
  }
  if (section) return <Navigate to={BASE} replace />;

  const stats = [
    { icon: Star, label: t('Reyting'), value: Number(data.ratingAvg).toFixed(1), hint: t('{ratingCount} ta sharh', { ratingCount: data.ratingCount }) },
    { icon: Award, label: t('Bajarilgan ishlar'), value: String(data.completedOrders) },
    { icon: CalendarClock, label: t('Tajriba'), value: data.experienceYears ? `${data.experienceYears} yil` : '—' },
    { icon: BadgeCheck, label: t('Yakunlash ko‘rsatkichi'), value: percent(data.completionRate) },
    { icon: MessageCircle, label: t('Javob berish'), value: percent(data.responseRate) },
  ];

  return (
    <div className="gm-pmenu-page gm-mprof">
      <div className="gm-page-header" style={{ marginBottom: 0 }}>
        <h1>{t('Profil')}</h1>
      </div>

      {user && (
        <section className="gm-mprof__card gm-mprof__id">
          <AvatarEditor name={name} seed={user.id} size="lg" src={user.avatar} canEdit={user.canSetAvatar !== false} />
          <h2>{name}</h2>
          <p className="gm-mprof__role">{data.profession ?? t('Kasb ko‘rsatilmagan')}</p>
          <div className="gm-mprof__badges">
            <Badge tone="primary">{t('Usta')}</Badge>
            <TrustBadge verification={data.verification} />
            <Badge tone={data.isPaused ? 'warning' : STATUS_TONE[data.status]}>{data.isPaused ? t('Pauzada') : statusLabel(data.status)}</Badge>
          </div>
        </section>
      )}

      <dl className="gm-mprof__stats">
        {stats.map((stat) => (
          <div key={stat.label} className="gm-mprof__stat">
            <dt>
              <stat.icon size={15} aria-hidden="true" /> {stat.label}
            </dt>
            <dd>{stat.value}</dd>
            {stat.hint && <small>{stat.hint}</small>}
          </div>
        ))}
      </dl>

      <ProfileMenuList
        rows={[
          { key: 'edit', icon: UserRound, label: t('Profilni tahrirlash'), to: `${BASE}/tahrirlash` },
          { key: 'account', icon: Smartphone, label: t('Akkaunt ma’lumotlari'), to: `${BASE}/akkaunt` },
          { key: 'state', icon: Power, label: t('Ish holati'), value: data.isPaused ? t('Pauzada') : statusLabel(data.status), to: `${BASE}/holat` },
          { key: 'services', icon: Wrench, label: t('Xizmatlarim'), to: `${BASE}/xizmatlar` },
          { key: 'trust', icon: ShieldCheck, label: t('Tasdiqlash'), value: <TrustBadge verification={data.verification} />, to: `${BASE}/tasdiqlash` },
          { key: 'area', icon: MapPin, label: t('Ish hududi'), to: `${BASE}/hudud` },
          { key: 'settings', icon: Settings, label: t('Sozlamalar'), to: '/sozlamalar' },
          { key: 'logout', icon: LogOut, label: t('Tizimdan chiqish'), danger: true, onClick: () => setLogoutOpen(true) },
        ]}
      />
      <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </div>
  );
}
