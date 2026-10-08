import { Link } from 'react-router-dom';
import { BadgeCheck, Play, TriangleAlert } from 'lucide-react';
import { env } from '@/lib/env';
import { t } from '@/i18n';
import { clock, POST_LINK } from '../format';
import { useFeedPost } from '../hooks';
import './feed-share-card.css';

/** Xabar faqat lenta havolasidan iborat bo‘lsa, uning post ID sini qaytaradi. */
export function feedPostId(text: string | null | undefined): string | null {
  const value = text?.trim();
  if (!value) return null;
  const match = POST_LINK.exec(value);
  return match && value.replace(match[0], '').replace(/^https?:\/\/[^/\s]*/i, '').trim() === '' ? (match[1] ?? null) : null;
}

/** Chatdagi ulashilgan ish: muqova, usta, kategoriya, qisqa tavsif va davomiylik. Bosilsa, lentadagi asl postga o‘tadi. */
export function FeedShareCard({ postId, mine }: { postId: string; mine: boolean }) {
  const post = useFeedPost(postId);
  const base = env.appRole === 'MASTER' ? '/usta' : '/mijoz';

  if (post.isLoading) return <span className="gf-sc gf-sc--skel" aria-hidden="true" />;
  if (post.isError || !post.data) {
    return (
      <span className="gf-sc gf-sc--gone" role="note">
        <TriangleAlert size={18} aria-hidden="true" />
        <span>
          <strong>{t('Ish topilmadi')}</strong>
          <small>{t('Usta uni o‘chirgan yoki u endi ochiq emas.')}</small>
        </span>
      </span>
    );
  }
  const item = post.data;
  const cover = item.media.coverUrl ?? item.media.afterUrl;
  return (
    <Link to={`${base}/lenta?post=${item.id}`} className={mine ? 'gf-sc gf-sc--mine' : 'gf-sc'} aria-label={t('{name} ishini ochish', { name: item.master.name })}>
      <span className="gf-sc__cover">
        {cover ? <img src={cover} alt="" loading="lazy" draggable={false} /> : <span className="gf-sc__blank" />}
        {item.kind === 'VIDEO' && (
          <span className="gf-sc__play" aria-hidden="true">
            <Play size={18} fill="currentColor" />
          </span>
        )}
        {item.kind === 'VIDEO' && item.durationSec ? <span className="gf-sc__dur">{clock(item.durationSec)}</span> : null}
        {item.kind === 'BEFORE_AFTER' && <span className="gf-sc__dur">{t('Oldin / Keyin')}</span>}
      </span>
      <span className="gf-sc__body">
        <strong>
          {item.master.name}
          {item.master.verified && <BadgeCheck size={14} aria-hidden="true" />}
        </strong>
        {(item.category || item.service) && <em>{item.service?.name ?? item.category?.name}</em>}
        {item.caption && <small>{item.caption}</small>}
        <span className="gf-sc__cta">{t('Lentada ko‘rish')}</span>
      </span>
    </Link>
  );
}
