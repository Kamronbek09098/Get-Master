import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link2, Send, Trash2, UserRound } from 'lucide-react';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';
import { postLink } from '../format';
import { useRemovePost } from '../hooks';
import type { FeedPost } from '../types';
import { Sheet } from './Sheet';

export function MoreSheet({ post, base, anchor, onClose, onMaster, onShare }: { post: FeedPost | null; base: string; anchor: DOMRect | null; onClose: () => void; onMaster: (post: FeedPost) => void; onShare: (post: FeedPost) => void }) {
  const toast = useAppStore((state) => state.pushToast);
  const remove = useRemovePost();
  const wide = typeof window !== 'undefined' && window.innerWidth >= 1280 && !!anchor;
  useEffect(() => {
    if (!wide || !post) return;
    const key = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [wide, post, onClose]);
  const menu = post && (
        <ul className="gf-menu">
          <li>
            <button type="button" onClick={() => { onClose(); onShare(post); }}>
              <Send size={20} aria-hidden="true" /> {t('Ulashish')}
            </button>
          </li>
          <li>
            <button type="button" onClick={() => { onClose(); onMaster(post); }}>
              <UserRound size={20} aria-hidden="true" /> {t('Usta profilini ko‘rish')}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(postLink(post.id, base)).then(() => toast(t('Havola nusxalandi'), 'success'), () => toast(t('Nusxalab bo‘lmadi'), 'error'));
                onClose();
              }}
            >
              <Link2 size={20} aria-hidden="true" /> {t('Havolani nusxalash')}
            </button>
          </li>
          {post.viewer.own && (
            <li>
              <button type="button" className="is-danger" disabled={remove.isPending} onClick={() => remove.mutate(post.id, { onSuccess: () => { toast(t('Ish o‘chirildi'), 'success'); onClose(); } })}>
                <Trash2 size={20} aria-hidden="true" /> {remove.isPending ? t('O‘chirilmoqda…') : t('Ishni o‘chirish')}
              </button>
            </li>
          )}
        </ul>
  );
  if (wide && post && anchor) {
    return createPortal(
      <div className="gf-pop-bg" onMouseDown={onClose}>
        <div className="gf-pop" role="menu" style={{ left: Math.min(anchor.left - 8, window.innerWidth - 280), bottom: Math.max(12, window.innerHeight - anchor.top + 6) }} onMouseDown={(event) => event.stopPropagation()}>
          {menu}
        </div>
      </div>,
      document.body,
    );
  }
  return (
    <Sheet open={!!post} onClose={onClose} title={t('Yana')}>
      {menu}
    </Sheet>
  );
}
