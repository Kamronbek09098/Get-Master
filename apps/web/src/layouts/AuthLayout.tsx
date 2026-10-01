import { Link, Outlet, useLocation } from 'react-router-dom';
import { BadgeCheck, Camera, ShieldCheck, Sparkles, Star, Wallet, ClipboardCheck, BarChart3, Lock, ScrollText, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { env } from '@/lib/env';
import { currentPanelLabel } from '@/lib/panel';
import type { Role } from '@/types/common';
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
    tagline: 'Tasdiqlangan ustalar, aniq narx va kafolat — bir joyda',
    tiles: [
      { icon: BadgeCheck, text: 'Tasdiqlangan ustalar' },
      { icon: Camera, text: 'Foto isbot' },
      { icon: ShieldCheck, text: 'Xavfsiz to‘lov' },
    ],
    title: 'Muammoni ayting — mos ustani biz topamiz',
    text: 'Tasdiqlangan ustalar, aniq narx va ish kafolati. Hammasi bir joyda.',
    points: [
      { icon: BadgeCheck, text: 'Shaxsi tasdiqlangan ustalar' },
      { icon: Camera, text: 'Ish oldidan va keyingi surat isboti' },
      { icon: ShieldCheck, text: 'Xavfsiz to‘lov va kafolat' },
    ],
  },
  MASTER: {
    tagline: 'Mijozlar o‘zi topadi — siz ishlaysiz',
    tiles: [
      { icon: ClipboardCheck, text: 'Mos so‘rovlar' },
      { icon: Wallet, text: 'Shaffof daromad' },
      { icon: Star, text: 'Reyting' },
    ],
    title: 'Mijozlar o‘zi topadi — siz ishlaysiz',
    text: 'Profilingizni to‘ldiring, tasdiqlating va yaqin atrofdagi so‘rovlarga taklif bering.',
    points: [
      { icon: ClipboardCheck, text: 'Sizga mos so‘rovlar avtomatik keladi' },
      { icon: Wallet, text: 'Daromad va to‘lovlar shaffof' },
      { icon: Star, text: 'Reyting va sharhlar sizga ishlaydi' },
    ],
  },
  ADMIN: {
    tagline: 'Platformani boshqarish paneli',
    tiles: [
      { icon: BarChart3, text: 'Hisobotlar' },
      { icon: BadgeCheck, text: 'Tasdiqlash' },
      { icon: ScrollText, text: 'Audit' },
    ],
    title: 'Platformani boshqarish paneli',
    text: 'Faqat vakolatli xodimlar uchun. Har bir harakat audit jurnaliga yoziladi.',
    points: [
      { icon: BarChart3, text: 'Statistika va hisobotlar' },
      { icon: BadgeCheck, text: 'Ustalarni tasdiqlash va moderatsiya' },
      { icon: ScrollText, text: 'To‘liq audit jurnali' },
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
        <Link to="/" className="gm-auth-layout__logo" aria-label="GetMaster — bosh sahifa">
          <Logo />
        </Link>
        <div className="gm-auth-layout__pitch">
          <span className="gm-auth-layout__eyebrow">
            <Sparkles size={15} /> {currentPanelLabel ?? 'GetMaster'}
          </span>
          <h2>{pitch.title}</h2>
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
          <Lock size={14} /> Ma’lumotlaringiz himoyalangan
        </p>
      </aside>

      <main className="gm-auth-layout__main">
        <div className="gm-auth-layout__topbar">
          <Link to="/" className="gm-auth-layout__mobile-logo" aria-label="GetMaster — bosh sahifa">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <div className="gm-auth-hero">
          <Link to="/" className="gm-auth-hero__mark" aria-label="GetMaster — bosh sahifa">
            <Wrench size={isLogin ? 34 : 26} strokeWidth={2.3} />
          </Link>
          <div className="gm-auth-hero__name">
            Get<b>Master</b>
          </div>
          {currentPanelLabel && <span className="gm-auth-hero__panel">{currentPanelLabel}</span>}
          <p className="gm-auth-hero__tagline">{pitch.tagline}</p>
        </div>
        <div className="gm-auth-layout__panel">
          {currentPanelLabel && <div className="gm-panel-badge">{currentPanelLabel}</div>}
          <Outlet />
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
            <p className="gm-auth-terms">
              Davom etish orqali{' '}
              <Link to="/shartlar" target="_blank" rel="noopener">
                xizmat shartlariga
              </Link>{' '}
              rozilik bildirasiz. Raqamingiz faqat kirish uchun ishlatiladi.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
