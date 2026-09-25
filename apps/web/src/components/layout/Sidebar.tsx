import { NavLink, useLocation } from 'react-router-dom';
import { badgeText, useNavBadges } from '@/features/admin/hooks/useNavBadges';
import { useAuthStore } from '@/store/auth.store';
import { getNavItems } from './nav-items';
import type { NavItem } from './nav-items';
import './Sidebar.css';

function groupItems(items: NavItem[]): Array<[string, NavItem[]]> {
  const groups = new Map<string, NavItem[]>();
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  return [...groups.entries()];
}

export function Sidebar() {
  const preferredRole = useAuthStore((state) => state.preferredRole);
  const groups = groupItems(getNavItems(preferredRole));
  const { pathname } = useLocation();
  const badges = useNavBadges(preferredRole, pathname);

  return (
    <nav className="gm-sidebar" aria-label="Asosiy navigatsiya">
      {groups.map(([group, items]) => (
        <div key={group} className="gm-sidebar__group">
          <p className="gm-sidebar__heading">{group}</p>
          <ul className="gm-sidebar__list">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/admin'}
                  className={({ isActive }) => `gm-sidebar__link${isActive ? ' gm-sidebar__link--active' : ''}`}
                >
                  <item.icon size={19} strokeWidth={2} aria-hidden="true" />
                  <span>{item.label}</span>
                  {badges[item.to] && (
                    <span className="gm-nav-badge" role="status" aria-label={`${badges[item.to]!.count} ta yangi`}>
                      {badgeText(badges[item.to]!)}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
