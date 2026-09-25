import { Wrench } from 'lucide-react';
import { cx } from '@/lib/utils';
import './Logo.css';

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cx('gm-logo', className)}>
      <span className="gm-logo__mark" aria-hidden="true">
        <Wrench size={18} strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className="gm-logo__word">
          Get<b>Master</b>
        </span>
      )}
    </span>
  );
}
