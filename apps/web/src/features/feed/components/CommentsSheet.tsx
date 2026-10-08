import { useState } from 'react';
import type { FormEvent } from 'react';
import { MessageCircle, SendHorizontal, Trash2 } from 'lucide-react';
import { getErrorMessage } from '@/lib/error-messages';
import { formatRelativeTime } from '@/lib/utils';
import { useMe } from '@/features/session/hooks/useMe';
import { t } from '@/i18n';
import { useAddComment, useComments, useRemoveComment } from '../hooks';
import type { FeedPost } from '../types';
import { Sheet } from './Sheet';

export function CommentsSheet({ post, onClose }: { post: FeedPost | null; onClose: () => void }) {
  const id = post?.id ?? '';
  const comments = useComments(post ? id : null);
  const add = useAddComment(id);
  const remove = useRemoveComment(id);
  const me = useMe();
  const [text, setText] = useState('');
  const items = comments.data?.items ?? [];

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    add.mutate(value, { onSuccess: () => setText('') });
  }

  return (
    <Sheet open={!!post} onClose={onClose} title={t('Izohlar')} subtitle={post ? t('{count} ta izoh', { count: post.counts.comments }) : undefined} tall>
      <div className="gf-comments">
        {comments.isLoading && (
          <ul className="gf-skel-list" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="gf-skel gf-skel--row" />
            ))}
          </ul>
        )}
        {comments.isError && <p className="gf-note gf-note--err" role="alert">{getErrorMessage(comments.error)}</p>}
        {!comments.isLoading && !comments.isError && items.length === 0 && (
          <div className="gf-empty gf-empty--sm">
            <MessageCircle size={28} aria-hidden="true" />
            <strong>{t('Hali izoh yo‘q')}</strong>
            <p>{t('Ish haqida birinchi bo‘lib fikr bildiring.')}</p>
          </div>
        )}
        <ul className="gf-comments__list">
          {items.map((comment) => (
            <li key={comment.id}>
              <span className="gf-avatar gf-avatar--sm" aria-hidden="true">{comment.author.charAt(0).toUpperCase()}</span>
              <div>
                <p>
                  <strong>{comment.author}</strong> <time>{formatRelativeTime(comment.createdAt)}</time>
                </p>
                <p className="gf-comments__text">{comment.text}</p>
              </div>
              {(comment.userId === me.data?.id || post?.viewer.own) && (
                <button type="button" className="gf-iconbtn gf-iconbtn--sm" aria-label={t('Izohni o‘chirish')} disabled={remove.isPending} onClick={() => remove.mutate(comment.id)}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <form className="gf-compose" onSubmit={submit}>
        <input value={text} onChange={(event) => setText(event.target.value)} maxLength={500} placeholder={t('Izoh yozing…')} aria-label={t('Izoh yozing')} />
        <button type="submit" className="gf-iconbtn gf-iconbtn--accent" disabled={!text.trim() || add.isPending} aria-label={t('Yuborish')}>
          <SendHorizontal size={20} aria-hidden="true" />
        </button>
      </form>
      {add.isError && <p className="gf-note gf-note--err" role="alert">{getErrorMessage(add.error)}</p>}
    </Sheet>
  );
}
