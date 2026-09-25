import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, UserRound, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/auth.store';
import { RedirectIfAuthed } from '@/router/ProtectedRoute';
import type { Role } from '@/types/common';
import { LandingPage } from './landing/LandingPage';
import './RoleSelectPage.css';

const OPTIONS: Array<{ role: Role; icon: LucideIcon; title: string; text: string }> = [
  { role: 'CUSTOMER', icon: UserRound, title: 'Men mijozman', text: 'Muammoni tasvirlab, mos ustani topaman' },
  { role: 'MASTER', icon: Wrench, title: 'Men ustaman', text: 'Buyurtmalar olaman va daromad topaman' },
  { role: 'ADMIN', icon: Shield, title: 'Administrator', text: 'Platformani boshqaraman' },
];

export function RoleSelectPage() {
  const navigate = useNavigate();
  const setPreferredRole = useAuthStore((s) => s.setPreferredRole);

  if (env.appRole === 'ADMIN') {
    return (
      <RedirectIfAuthed>
        <Navigate to="/login" replace />
      </RedirectIfAuthed>
    );
  }
  if (env.appRole) {
    return (
      <RedirectIfAuthed>
        <LandingPage />
      </RedirectIfAuthed>
    );
  }

  return (
    <RedirectIfAuthed>
      <div className="gm-role-select">
        <div className="gm-role-select__top">
          <ThemeToggle />
        </div>
        <div className="gm-role-select__body">
          <Logo />
          <h1>GetMaster’ga xush kelibsiz</h1>
          <p>Davom etish uchun rolingizni tanlang.</p>
          <div className="gm-role-select__options">
            {OPTIONS.map((option) => (
              <button
                key={option.role}
                type="button"
                className="gm-role-select__option"
                onClick={() => {
                  setPreferredRole(option.role);
                  navigate('/login');
                }}
              >
                <span className="gm-role-select__icon">
                  <option.icon size={24} strokeWidth={2} />
                </span>
                <span className="gm-role-select__text">
                  <strong>{option.title}</strong>
                  <small>{option.text}</small>
                </span>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </RedirectIfAuthed>
  );
}
