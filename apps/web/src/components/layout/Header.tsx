import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Settings } from 'lucide-react';
import { Dropdown } from '@/components/ui/Dropdown';
import { Logo } from '@/components/common/Logo';
import { useAuthStore } from '@/store/auth.store';
import { useLogout } from '@/features/auth/hooks/useAuth';
import { useUnreadCount } from '@/features/notification/hooks/useNotifications';
import { useMe } from '@/features/session/hooks/useMe';
import { currentPanelLabel } from '@/lib/panel';
import { initials } from '@/lib/utils';
import { getNavItems } from './nav-items';
import { ThemeToggle } from './ThemeToggle';
import './Header.css';

const ROLE_LABEL: Record<string, string> = { CUSTOMER: 'Mijoz', MASTER: 'Usta', ADMIN: 'Administrator' };

export function Header() {
  const preferredRole = useAuthStore((s) => s.preferredRole);
  const logout = useLogout();
  const navigate = useNavigate();
  const me = useMe();
  const unread = useUnreadCount();

  const name = [me.data?.firstName, me.data?.lastName].filter(Boolean).join(' ') || me.data?.phone || '';
  const home = getNavItems(preferredRole)[0]?.to ?? '/';
  const roleText = currentPanelLabel ?? (preferredRole ? ROLE_LABEL[preferredRole] : null);
  const count = unread.data?.count ?? 0;

  return (
    <header className="gm-header">
      <Link to={home} className="gm-header__brand" aria-label="GetMaster — bosh sahifa">
        <Logo />
      </Link>
      {roleText && <span className="gm-header__panel">{roleText}</span>}

      <div className="gm-header__actions">
        <ThemeToggle />
        <Link to="/bildirishnomalar" className="gm-icon-button" aria-label={count > 0 ? `Bildirishnomalar, ${count} ta yangi` : 'Bildirishnomalar'}>
          <Bell size={19} strokeWidth={2} />
          {count > 0 && <span className="gm-icon-button__dot">{count > 9 ? '9+' : count}</span>}
        </Link>
        <Dropdown
          trigger={
            <>
              <span className="gm-avatar" aria-hidden="true">
                {initials(name)}
              </span>
              <span className="gm-header__user">{name || 'Menyu'}</span>
            </>
          }
          items={[
            { label: 'Sozlamalar va sessiyalar', icon: <Settings size={17} />, onSelect: () => navigate('/sozlamalar') },
            { label: 'Chiqish', icon: <LogOut size={17} />, onSelect: () => logout.mutate(false), danger: true },
          ]}
        />
      </div>
    </header>
  );
}
