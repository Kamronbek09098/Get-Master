import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Settings } from 'lucide-react';
import { Dropdown } from '@/components/ui/Dropdown';
import { Logo } from '@/components/common/Logo';
import { useAuthStore } from '@/store/auth.store';
import { LogoutDialog } from '@/features/auth/components/LogoutDialog';
import { useUnreadCount } from '@/features/notification/hooks/useNotifications';
import { useMe } from '@/features/session/hooks/useMe';
import { currentPanelLabel } from '@/lib/panel';
import { t } from '@/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { initials } from '@/lib/utils';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { getNavItems } from './nav-items';
import { ThemeToggle } from './ThemeToggle';
import './Header.css';

const ROLE_LABEL: Record<string, string> = { CUSTOMER: t('Mijoz'), MASTER: t('Usta'), ADMIN: t('Administrator') };

export function Header() {
  const preferredRole = useAuthStore((s) => s.preferredRole);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const navigate = useNavigate();
  const me = useMe();
  const unread = useUnreadCount();

  const name = [me.data?.firstName, me.data?.lastName].filter(Boolean).join(' ') || me.data?.phone || '';
  const home = getNavItems(preferredRole, { superAdmin: true })[0]?.to ?? '/';
  const roleText = preferredRole === 'ADMIN' && me.data?.isSuperAdmin ? t('Superadmin paneli') : (currentPanelLabel ?? (preferredRole ? ROLE_LABEL[preferredRole] : null));
  const count = unread.data?.count ?? 0;

  return (
    <header className="gm-header">
      <Link to={home} className="gm-header__brand" aria-label={t('GetMaster — bosh sahifa')}>
        <Logo />
      </Link>
      {roleText && <span className="gm-header__panel">{roleText}</span>}

      <div className="gm-header__actions">
        <LanguageSwitcher />
        <ThemeToggle />
        <Link to="/bildirishnomalar" className="gm-icon-button" aria-label={count > 0 ? t('Bildirishnomalar, {count} ta yangi', { count }) : t('Bildirishnomalar')}>
          <Bell size={19} strokeWidth={2} />
          {count > 0 && <span className="gm-icon-button__dot">{count > 9 ? '9+' : count}</span>}
        </Link>
        <Dropdown
          trigger={
            <>
              {me.data?.avatar ? (
                <ChatAvatar name={name} seed={me.data.id} size="sm" src={me.data.avatar} />
              ) : (
                <span className="gm-avatar" aria-hidden="true">
                  {initials(name)}
                </span>
              )}
              <span className="gm-header__user">{name || t('Menyu')}</span>
            </>
          }
          items={[
            { label: t('Sozlamalar va sessiyalar'), icon: <Settings size={17} />, onSelect: () => navigate('/sozlamalar') },
            { label: t('Chiqish'), icon: <LogOut size={17} />, onSelect: () => setLogoutOpen(true), danger: true },
          ]}
        />
      </div>
      <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </header>
  );
}
