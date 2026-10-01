import { ShieldCheck } from 'lucide-react';
import { cx, initials } from '@/lib/utils';
import { avatarTone } from '../format';

export function ChatAvatar({ name, seed, size = 'md', admin = false }: { name: string; seed: string; size?: 'sm' | 'md' | 'lg'; admin?: boolean }) {
  if (admin) {
    return (
      <span className={cx('gm-chat-avatar', `gm-chat-avatar--${size}`, 'gm-chat-avatar--admin')} aria-hidden="true">
        <ShieldCheck size={size === 'lg' ? 26 : size === 'sm' ? 14 : 20} />
      </span>
    );
  }
  return (
    <span className={cx('gm-chat-avatar', `gm-chat-avatar--${size}`, `gm-tone-${avatarTone(seed || name)}`)} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
