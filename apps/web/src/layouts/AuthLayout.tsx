import { Link, Outlet } from 'react-router-dom';
import { BadgeCheck, Camera, ShieldCheck, Sparkles, Star, Wallet, ClipboardCheck, BarChart3, Lock, ScrollText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { env } from '@/lib/env';
import { currentPanelLabel } from '@/lib/panel';
import type { Role } from '@/types/common';
import '@/features/auth/auth.css';
import './AuthLayout.css';

interface Pitch {
  title: string;
  text: string;
  points: Array<{ icon: LucideIcon; text: string }>;
}

const PITCH: Record<Role, Pitch> = {
  CUSTOMER: {
    title: 'Muammoni ayting — mos ustani biz topamiz',
    text: 'Tasdiqlangan ustalar, aniq narx va ish kafolati. Hammasi bir joyda.',
    points: [
      { icon: BadgeCheck, text: 'Shaxsi tasdiqlangan ustalar' },
      { icon: Camera, text: 'Ish oldidan va keyingi surat isboti' },
      { icon: ShieldCheck, text: 'Xavfsiz to‘lov va kafolat' },
    ],
  },
  MASTER: {
    title: 'Mijozlar o‘zi topadi — siz ishlaysiz',
    text: 'Profilingizni to‘ldiring, tasdiqlating va yaqin atrofdagi so‘rovlarga taklif bering.',
    points: [
      { icon: ClipboardCheck, text: 'Sizga mos so‘rovlar avtomatik keladi' },
      { icon: Wallet, text: 'Daromad va to‘lovlar shaffof' },
      { icon: Star, text: 'Reyting va sharhlar sizga ishlaydi' },
    ],
  },
  ADMIN: {
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

  return (
    <div className="gm-auth-layout">
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
        <div className="gm-auth-layout__panel">
          {currentPanelLabel && <div className="gm-panel-badge">{currentPanelLabel}</div>}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
