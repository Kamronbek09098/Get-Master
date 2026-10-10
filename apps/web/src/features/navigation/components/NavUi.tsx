import { useId } from 'react';
import type { ReactNode } from 'react';
import { ArrowUp, ArrowUpLeft, ArrowUpRight, CornerUpLeft, CornerUpRight, Flag, Navigation, RefreshCw, Undo2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '@/lib/utils';
import type { Maneuver } from '../geometry';
import { formatDistance } from '../geometry';
import type { MapTheme, NavSettings, SoundMode, VolumeLevel } from '../settings';
import { t } from '@/i18n';

export const MANEUVER_ICON: Record<Maneuver, LucideIcon> = {
  straight: ArrowUp,
  depart: Navigation,
  left: CornerUpLeft,
  right: CornerUpRight,
  'slight-left': ArrowUpLeft,
  'slight-right': ArrowUpRight,
  'sharp-left': CornerUpLeft,
  'sharp-right': CornerUpRight,
  uturn: Undo2,
  roundabout: RefreshCw,
  arrive: Flag,
};

/** Burilish belgisi: ko‘k yumaloq karta, ichida burilish strelkasi va masofa («↰ 10 m»). Xaritada burilish nuqtasida turadi. */
export function ManeuverSign({ maneuver, meters, arrived = false, label }: { maneuver: Maneuver; meters: number; arrived?: boolean; label?: string }) {
  const Icon = MANEUVER_ICON[arrived ? 'arrive' : maneuver];
  return (
    <div className={cx('gn-signcard', arrived && 'is-arrived')} role="status" aria-live="polite" aria-label={label}>
      <Icon size={30} strokeWidth={2.6} aria-hidden="true" />
      <strong>{arrived ? t('Manzil') : formatDistance(meters)}</strong>
    </div>
  );
}

/** Yumaloq suzuvchi tugma (xarita ustida). */
export function RoundBtn({ label, onClick, to, children, active = false, className, disabled }: { label: string; onClick?: () => void; to?: string; children: ReactNode; active?: boolean; className?: string; disabled?: boolean }) {
  const cls = cx('gn-round', active && 'is-on', className);
  if (to) {
    return (
      <a className={cls} href={to} aria-label={label} title={label}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} aria-label={label} title={label} aria-pressed={active || undefined} disabled={disabled}>
      {children}
    </button>
  );
}

/** Marshrut chizig‘i: o‘tilgan qism kulrang, qolgani ko‘k; boshida joriy joy (sariq uchburchak), oxirida manzil (doira). */
export function RouteBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (done / total) * 100)) : 0;
  return (
    <div className="gn-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={t('Marshrut bo‘yicha o‘tilgan qism')}>
      <span className="gn-bar__track">
        <i className="gn-bar__done" style={{ width: `${pct}%` }} />
        <i className="gn-bar__todo" style={{ left: `${pct}%` }} />
      </span>
      <span className="gn-bar__me" style={{ left: `${pct}%` }} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 4 21 12 3 20 7 12Z" fill="#ffc400" stroke="#8a5a00" strokeWidth="1.5" strokeLinejoin="round" /></svg>
      </span>
      <span className="gn-bar__end" aria-hidden="true" />
    </div>
  );
}

/** Sozlamalar oynasidagi tanlov tugmalari qatori (yarim shaffof kartalar, tanlangani ajralib turadi). */
export function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string; icon?: ReactNode }>; onChange: (next: T) => void; label: string }) {
  return (
    <div className="gn-choice" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" role="radio" aria-checked={value === option.value} className={cx(value === option.value && 'is-on')} onClick={() => onChange(option.value)}>
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint, icon }: { checked: boolean; onChange: (next: boolean) => void; label: string; hint?: string; icon?: ReactNode }) {
  const id = useId();
  return (
    <div className="gn-toggle">
      {icon && <span className="gn-toggle__icon" aria-hidden="true">{icon}</span>}
      <label htmlFor={id}>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </label>
      <button id={id} type="button" role="switch" aria-checked={checked} className={cx('gn-switch', checked && 'is-on')} onClick={() => onChange(!checked)}>
        <i aria-hidden="true" />
      </button>
    </div>
  );
}

export const SOUND_OPTIONS = (icons: { off: ReactNode; important: ReactNode; all: ReactNode }): Array<{ value: SoundMode; label: string; icon: ReactNode }> => [
  { value: 'off', label: t('Hammasini o‘chirish'), icon: icons.off },
  { value: 'important', label: t('Faqat muhim'), icon: icons.important },
  { value: 'all', label: t('Hamma ovozlar'), icon: icons.all },
];
export const VOLUME_OPTIONS = (): Array<{ value: VolumeLevel; label: string }> => [
  { value: 'low', label: t('Past') },
  { value: 'mid', label: t('O‘rta') },
  { value: 'high', label: t('Baland') },
];
export const THEME_OPTIONS = (): Array<{ value: MapTheme; label: string }> => [
  { value: 'auto', label: t('Avto') },
  { value: 'light', label: t('Kunduzgi') },
  { value: 'dark', label: t('Tungi') },
];
export type { NavSettings };
