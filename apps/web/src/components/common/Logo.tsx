import { Link, useLocation } from 'react-router-dom';
import { cx } from '@/lib/utils';
import './Logo.css';
import { t } from '@/i18n';

/** GetMaster logotipi: uy + joy belgisi ichida usta. `onDark` — har doim to‘q fon ustida (oq tom, oq yozuv) varianti. */
export function Logo({ className, compact = false, onDark = false }: { className?: string; compact?: boolean; onDark?: boolean }) {
  return (
    <span className={cx('gm-logo', onDark && 'gm-logo--on-dark', className)}>
      <span className="gm-logo__mark" aria-hidden="true">
        <img className="gm-logo__img gm-logo__img--color" src="/brand/mark.png" alt="" width="40" height="40" decoding="async" draggable={false} />
        <img className="gm-logo__img gm-logo__img--dark" src="/brand/mark-ondark.png" alt="" width="40" height="40" decoding="async" draggable={false} />
      </span>
      {!compact && (
        <span className="gm-logo__word">{t('Get')}<b>{t('Master')}</b>
        </span>
      )}
    </span>
  );
}

/** Logotip havolasi: bosh sahifaga qaytaradi; allaqachon bosh sahifada bo‘lsa, silliq tepaga suradi. */
export function LogoLink({ to = '/', className, onDark = false }: { to?: string; className?: string; onDark?: boolean }) {
  const { pathname } = useLocation();
  return (
    <Link
      to={to}
      className={className}
      aria-label={t('GetMaster — bosh sahifa')}
      onClick={(event) => {
        if (pathname === to) {
          event.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          window.scrollTo(0, 0);
        }
      }}
    >
      <Logo onDark={onDark} />
    </Link>
  );
}
