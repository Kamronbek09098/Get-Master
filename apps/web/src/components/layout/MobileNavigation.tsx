import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutGrid, X } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useMe } from '@/features/session/hooks/useMe';
import { badgeText, useNavBadges } from '@/features/admin/hooks/useNavBadges';
import { getNavItems } from './nav-items';
import { t } from '@/i18n';
import './MobileNavigation.css';

export function MobileNavigation() {
  const preferredRole = useAuthStore((state) => state.preferredRole);
  const me = useMe();
  const items = getNavItems(preferredRole, { superAdmin: !!me.data?.isSuperAdmin, permissions: me.data?.adminPermissions });
  const primary = items.filter((item) => item.primary).slice(0, 4);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const badges = useNavBadges(preferredRole, pathname);
  const hiddenBadge = items.some((item) => !primary.includes(item) && badges[item.to]);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <nav className="gm-mobile-nav" aria-label={t('Asosiy navigatsiya')}>
        {primary.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin'}
            className={({ isActive }) => `gm-mobile-nav__link${isActive ? ' gm-mobile-nav__link--active' : ''}`}
          >
            <item.icon size={22} strokeWidth={2} aria-hidden="true" />
            {badges[item.to] && <span className="gm-nav-badge gm-nav-badge--corner">{badgeText(badges[item.to]!)}</span>}
            <span>{item.short ?? item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className="gm-mobile-nav__link"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <LayoutGrid size={22} strokeWidth={2} aria-hidden="true" />
          {hiddenBadge && <span className="gm-nav-badge gm-nav-badge--dot" aria-hidden="true" />}
          <span>{t('Yana')}</span>
        </button>
      </nav>

      {open && (
        <div className="gm-sheet-overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="gm-sheet" role="dialog" aria-modal="true" aria-label={t('Barcha bo‘limlar')}>
            <div className="gm-sheet__header">
              <h2>{t('Bo‘limlar')}</h2>
              <button type="button" className="gm-icon-button" aria-label={t('Yopish')} onClick={() => setOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="gm-sheet__grid">
              {items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/admin'} className="gm-sheet__item">
                  <span className="gm-sheet__icon">
                    <item.icon size={22} strokeWidth={2} aria-hidden="true" />
                    {badges[item.to] && <span className="gm-nav-badge gm-nav-badge--corner">{badgeText(badges[item.to]!)}</span>}
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
