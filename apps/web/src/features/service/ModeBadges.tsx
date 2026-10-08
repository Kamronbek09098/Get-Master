import { Home, Store } from 'lucide-react';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import type { ServiceMode } from './types';
import './ModeBadges.css';

export const MODE_LABEL: Record<ServiceMode, () => string> = {
  AT_CUSTOMER: () => t('Uyga boradi'),
  AT_MASTER: () => t('O‘z joyida qabul qiladi'),
};

/** Usta qayerda ishlashini ko‘rsatuvchi belgilar: «Uyga boradi» / «O‘z joyida qabul qiladi». */
export function ModeBadges({ modes, size = 'md' }: { modes?: ServiceMode[]; size?: 'sm' | 'md' }) {
  const list = modes && modes.length > 0 ? modes : (['AT_CUSTOMER'] as ServiceMode[]);
  return (
    <span className={cx('gm-modes', `gm-modes--${size}`)}>
      {list.map((mode) => (
        <span key={mode} className={cx('gm-modes__item', mode === 'AT_MASTER' && 'gm-modes__item--place')}>
          {mode === 'AT_MASTER' ? <Store size={size === 'sm' ? 12 : 14} aria-hidden="true" /> : <Home size={size === 'sm' ? 12 : 14} aria-hidden="true" />}
          {MODE_LABEL[mode]()}
        </span>
      ))}
    </span>
  );
}
