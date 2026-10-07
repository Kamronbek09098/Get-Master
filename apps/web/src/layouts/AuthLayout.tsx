import { Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { PageLoader } from '@/components/common/PageLoader';
import { BadgeCheck, Camera, ShieldCheck, Sparkles, Star, Wallet, ClipboardCheck, BarChart3, Lock, ScrollText, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ShaderBackground } from '@/pages/landing/fx/ShaderBackground';
import { Logo } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { env } from '@/lib/env';
import { currentPanelLabel } from '@/lib/panel';
import type { Role } from '@/types/common';
import { t } from '@/i18n';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import '@/features/auth/auth.css';
import './AuthLayout.css';

interface Pitch {
  tagline: string;
  tiles: Array<{ icon: LucideIcon; text: string }>;
  title: string;
  text: string;
  points: Array<{ icon: LucideIcon; text: string }>;
}

const PITCH: Record<Role, Pitch> = {
  CUSTOMER: {
    tagline: t('Tasdiqlangan ustalar, aniq narx va kafolat — bir joyda'),
    tiles: [
      { icon: BadgeCheck, text: t('Tasdiqlangan ustalar') },
      { icon: Camera, text: t('Foto isbot') },
      { icon: ShieldCheck, text: t('Xavfsiz to‘lov') },
    ],
    title: t('Muammoni ayting — mos ustani biz topamiz'),
    text: t('Tasdiqlangan ustalar, aniq narx va ish kafolati. Hammasi bir joyda.'),
    points: [
      { icon: BadgeCheck, text: t('Shaxsi tasdiqlangan ustalar') },
      { icon: Camera, text: t('Ish oldidan va keyingi surat isboti') },
      { icon: ShieldCheck, text: t('Xavfsiz to‘lov va kafolat') },
    ],
  },
  MASTER: {
    tagline: t('Mijozlar o‘zi topadi — siz ishlaysiz'),
    tiles: [
      { icon: ClipboardCheck, text: t('Mos so‘rovlar') },
      { icon: Wallet, text: t('Shaffof daromad') },
      { icon: Star, text: t('Reyting') },
    ],
    title: t('Mijozlar o‘zi topadi — siz ishlaysiz'),
    text: t('Profilingizni to‘ldiring, tasdiqlating va yaqin atrofdagi so‘rovlarga taklif bering.'),
    points: [
      { icon: ClipboardCheck, text: t('Sizga mos so‘rovlar avtomatik keladi') },
      { icon: Wallet, text: t('Daromad va to‘lovlar shaffof') },
      { icon: Star, text: t('Reyting va sharhlar sizga ishlaydi') },
    ],
  },
  ADMIN: {
    tagline: t('Platformani boshqarish paneli'),
    tiles: [
      { icon: BarChart3, text: t('Hisobotlar') },
      { icon: BadgeCheck, text: t('Tasdiqlash') },
      { icon: ScrollText, text: t('Audit') },
    ],
    title: t('Platformani boshqarish paneli'),
    text: t('Faqat vakolatli xodimlar uchun. Har bir harakat audit jurnaliga yoziladi.'),
    points: [
      { icon: BarChart3, text: t('Statistika va hisobotlar') },
      { icon: BadgeCheck, text: t('Ustalarni tasdiqlash va moderatsiya') },
      { icon: ScrollText, text: t('To‘liq audit jurnali') },
    ],
  },
};

export function AuthLayout() {
  const pitch = PITCH[env.appRole ?? 'CUSTOMER'];
  const { pathname } = useLocation();
  const isLogin = pathname === '/login';

  return (
    <div className={isLogin ? 'gm-auth-layout gm-auth-layout--login' : 'gm-auth-layout'}>
      <aside className="gm-auth-layout__brand" aria-hidden={false}>
        <ShaderBackground variant="brand" />
        <Link to="/" className="gm-auth-layout__logo" aria-label={t('GetMaster — bosh sahifa')}>
          <Logo onDark />
        </Link>
        <div className="gm-auth-layout__pitch">
          <span className="gm-auth-layout__eyebrow">
            <Sparkles size={15} /> {currentPanelLabel ?? 'GetMaster'}
          </span>
          <h2 className="gm-auth-layout__headline" aria-label={pitch.title}>
            {pitch.title.split(' ').map((word, index) => (
              <span key={`${word}-${index}`} className="gm-auth-layout__word" style={{ ['--i' as string]: index }} aria-hidden="true">
                {word}
              </span>
            ))}
          </h2>
          <p>{pitch.text}</p>
          <ul>
            {pitch.points.map((point) => (
              <li key={point.text}>
                <span className="gm-auth-layout__point-icon">
                  <point.icon size={18} strokeWidth={2.2} />
                </span>
                {point.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="gm-auth-layout__foot">
          <Lock size={14} /> {t('Ma’lumotlaringiz himoyalangan')}
        </p>
      </aside>

      <main className="gm-auth-layout__main">
        <div className="gm-auth-layout__topbar">
          <Link to="/" className="gm-auth-layout__mobile-logo" aria-label={t('GetMaster — bosh sahifa')}>
            <Logo />
          </Link>
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="gm-auth-hero">
          <Link to="/" className="gm-auth-hero__mark" aria-label={t('GetMaster — bosh sahifa')}>
            <Wrench size={isLogin ? 34 : 26} strokeWidth={2.3} />
          </Link>
          <div className="gm-auth-hero__name">{t('Get')}<b>{t('Master')}</b>
          </div>
          {currentPanelLabel && <span className="gm-auth-hero__panel">{currentPanelLabel}</span>}
          <p className="gm-auth-hero__tagline">{pitch.tagline}</p>
        </div>
        <div className="gm-auth-layout__panel">
          {currentPanelLabel && <div className="gm-panel-badge">{currentPanelLabel}</div>}
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
        {isLogin && (
          <>
            <ul className="gm-auth-tiles">
              {pitch.tiles.map((tile) => (
                <li key={tile.text}>
                  <tile.icon size={20} strokeWidth={2.1} />
                  <span>{tile.text}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
