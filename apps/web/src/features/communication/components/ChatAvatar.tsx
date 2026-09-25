import { cx, initials } from '@/lib/utils';
import { avatarTone } from '../format';

export function ChatAvatar({ name, seed, size = 'md' }: { name: string; seed: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={cx('gm-chat-avatar', `gm-chat-avatar--${size}`, `gm-tone-${avatarTone(seed || name)}`)} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
