import { cx } from '@/lib/utils';
import './Spinner.css';

export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      className={cx('gm-spinner', `gm-spinner--${size}`, className)}
      role="status"
      aria-label="Yuklanmoqda"
    />
  );
}
