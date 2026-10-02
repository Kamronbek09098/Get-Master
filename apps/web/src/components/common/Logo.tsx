import { Wrench } from 'lucide-react';
import { cx } from '@/lib/utils';
import './Logo.css';
import { t } from '@/i18n';

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cx('gm-logo', className)}>
      <span className="gm-logo__mark" aria-hidden="true">
        <Wrench size={18} strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className="gm-logo__word">{t('Get')}<b>{t('Master')}</b>
        </span>
      )}
    </span>
  );
}
