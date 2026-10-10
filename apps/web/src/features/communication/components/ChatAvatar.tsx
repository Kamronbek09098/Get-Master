import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { cx, initials } from '@/lib/utils';
import { avatarSrc } from '@/lib/avatar';
import { avatarTone } from '../format';

interface ChatAvatarProps {
  name: string;
  seed: string;
  size?: 'sm' | 'md' | 'lg';
  admin?: boolean;
  /** Profil rasmi (backenddagi `avatar`). Yuklanmasa yoki bo‘lmasa — bosh harflar ko‘rsatiladi. */
  src?: string | null;
}

export function ChatAvatar({ name, seed, size = 'md', admin = false, src }: ChatAvatarProps) {
  const url = avatarSrc(src);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);

  if (admin) {
    return (
      <span className={cx('gm-chat-avatar', `gm-chat-avatar--${size}`, 'gm-chat-avatar--admin')} aria-hidden="true">
        <ShieldCheck size={size === 'lg' ? 26 : size === 'sm' ? 14 : 20} />
      </span>
    );
  }
  const showImage = !!url && !failed;
  return (
    <span className={cx('gm-chat-avatar', `gm-chat-avatar--${size}`, !showImage && `gm-tone-${avatarTone(seed || name)}`, showImage && 'gm-chat-avatar--photo')} aria-hidden="true">
      {showImage ? <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} /> : initials(name)}
    </span>
  );
}
