import { Bookmark, Link2, Trash2, UserRound } from 'lucide-react';
import { useAppStore } from '@/store/app.store';
import { t } from '@/i18n';
import { postLink } from '../format';
import { useRemovePost, useToggleSave } from '../hooks';
import type { FeedPost } from '../types';
import { Sheet } from './Sheet';

export function MoreSheet({ post, base, onClose, onMaster }: { post: FeedPost | null; base: string; onClose: () => void; onMaster: (post: FeedPost) => void }) {
  const toast = useAppStore((state) => state.pushToast);
  const save = useToggleSave();
  const remove = useRemovePost();
  return (
    <Sheet open={!!post} onClose={onClose} title={t('Yana')}>
      {post && (
        <ul className="gf-menu">
          <li>
            <button type="button" onClick={() => { save.mutate({ id: post.id, on: !post.viewer.saved }); onClose(); }}>
              <Bookmark size={20} fill={post.viewer.saved ? 'currentColor' : 'none'} aria-hidden="true" /> {post.viewer.saved ? t('Saqlanganlardan olib tashlash') : t('Saqlash')}
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
      )}
    </Sheet>
  );
}
