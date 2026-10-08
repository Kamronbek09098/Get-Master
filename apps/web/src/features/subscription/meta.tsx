import { BadgeCheck, Crown, Eye, History, Images, Sparkles, TrendingUp, Zap, type LucideIcon } from 'lucide-react';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import type { Feature } from './types';

export const FEATURE_META: Record<Feature, { icon: LucideIcon; title: () => string; text: () => string }> = {
  SEE_DELETED_MESSAGES: { icon: Eye, title: () => t('O‘chirilgan xabarlarni ko‘rish'), text: () => t('Suhbatdosh o‘chirib yuborgan xabarlarni ham o‘qiy olasiz.') },
  SEE_EDIT_HISTORY: { icon: History, title: () => t('Tahrir tarixi'), text: () => t('Tahrirlangan xabarning avvalgi matnlarini ko‘rasiz.') },
  PRIORITY_REQUESTS: { icon: Zap, title: () => t('Tezkor so‘rovlar'), text: () => t('So‘rovlaringiz ustalarga ajratib, birinchi bo‘lib ko‘rsatiladi.') },
  PLUS_BADGE: { icon: Sparkles, title: () => t('Plus belgisi'), text: () => t('Profilingizda ustalar ko‘radigan Plus belgisi paydo bo‘ladi.') },
  PRO_BADGE: { icon: BadgeCheck, title: () => t('Pro galochka'), text: () => t('Profil va kartangizda oltin Pro galochka ko‘rinadi.') },
  CATALOG_BOOST: { icon: TrendingUp, title: () => t('Katalogda yuqori o‘rin'), text: () => t('Ustalar ro‘yxatida boshqalardan oldin ko‘rsatilasiz.') },
  EXTRA_PORTFOLIO: { icon: Images, title: () => t('Ikki baravar ko‘p portfolio'), text: () => t('Portfolioga 40 tagacha ish qo‘sha olasiz.') },
};

/** Pro usta belgisi: oltin galochka (admin tasdiqlagan «Tasdiqlangan» belgisidan alohida). */
export function ProBadge({ size = 'md', label = true }: { size?: 'sm' | 'md'; label?: boolean }) {
  return (
    <span className={cx('gm-pro', `gm-pro--${size}`)} title={t('Pro obunali usta')}>
      <BadgeCheck size={size === 'sm' ? 13 : 15} aria-hidden="true" />
      {label && <span>Pro</span>}
    </span>
  );
}

/** Plus mijoz belgisi. */
export function PlusBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span className={cx('gm-pro gm-pro--plus', `gm-pro--${size}`)} title={t('Plus obunali mijoz')}>
      <Crown size={size === 'sm' ? 12 : 14} aria-hidden="true" />
      <span>Plus</span>
    </span>
  );
}
