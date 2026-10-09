import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Play, TriangleAlert, Volume2 } from 'lucide-react';
import { env } from '@/lib/env';
import { t } from '@/i18n';
import { clock, initials } from '../format';
import { useFeedPost } from '../hooks';
import { useStableUrl } from '../useStableUrl';
import './feed-share-card.css';

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Chatdagi ulashilgan ish (Instagramdagi kabi): usta, ish videosi o‘zi (ko‘ringanda ovozsiz avtomatik ijro etiladi),
 * qisqa tavsif. Bosilsa, lentadagi asl postga o‘tadi.
 */
export function FeedShareCard({ postId }: { postId: string; mine?: boolean }) {
  const post = useFeedPost(postId);
  const base = env.appRole === 'MASTER' ? '/usta' : '/mijoz';
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLAnchorElement>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoUrl = useStableUrl(post.data?.media.videoUrl);
  const coverUrl = useStableUrl(post.data?.media.coverUrl ?? post.data?.media.afterUrl);
  const beforeUrl = useStableUrl(post.data?.media.beforeUrl);
  const afterUrl = useStableUrl(post.data?.media.afterUrl);

  // Faqat ekranda ko‘ringanda ijro etiladi (trafik va batareyani tejaydi).
  useEffect(() => {
    const node = box.current;
    const el = video.current;
    if (!node || !el || reduceMotion()) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.55) void el.play().catch(() => undefined);
        else el.pause();
      },
      { threshold: [0, 0.55, 1] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [videoUrl]);

  if (post.isLoading) return <span className="gf-sc gf-sc--skel" aria-hidden="true" />;
  if (post.isError || !post.data) {
    return (
      <span className="gf-sc gf-sc--gone" role="note">
        <TriangleAlert size={20} aria-hidden="true" />
        <span>
          <strong>{t('Ish topilmadi')}</strong>
          <small>{t('Usta uni o‘chirgan yoki u endi ochiq emas.')}</small>
        </span>
      </span>
    );
  }
  const item = post.data;
  const isVideo = item.kind === 'VIDEO' && !!videoUrl && !failed;

  return (
    <Link ref={box} to={`${base}/lenta?post=${item.id}`} className="gf-sc" aria-label={t('{name} ishini ochish', { name: item.master.name })}>
      <span className="gf-sc__media">
        {isVideo && (
          <video
            ref={video}
            src={videoUrl ? `${videoUrl}#t=0.4` : undefined}
            poster={coverUrl ?? undefined}
            muted
            loop
            playsInline
            preload="metadata"
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => setFailed(true)}
            aria-hidden="true"
            tabIndex={-1}
          />
        )}
        {!isVideo && item.kind === 'BEFORE_AFTER' && beforeUrl && afterUrl && (
          <span className="gf-sc__split" aria-hidden="true">
            <img src={beforeUrl} alt="" draggable={false} />
            <img src={afterUrl} alt="" draggable={false} />
          </span>
        )}
        {!isVideo && item.kind !== 'BEFORE_AFTER' && coverUrl && <img src={coverUrl} alt="" draggable={false} />}
        <span className="gf-sc__who">
          <span className="gf-sc__ava" aria-hidden="true">{initials(item.master.name)}</span>
          <strong>
            {item.master.name}
            {item.master.verified && <BadgeCheck size={14} aria-label={t('Tasdiqlangan usta')} />}
          </strong>
        </span>
        {item.kind === 'VIDEO' && (
          <span className="gf-sc__mini" aria-hidden="true">
            <Play size={16} fill="currentColor" />
          </span>
        )}
        {item.kind === 'VIDEO' && item.durationSec ? <span className="gf-sc__chip">{clock(item.durationSec)}</span> : null}
        {item.kind === 'BEFORE_AFTER' && <span className="gf-sc__chip">{t('Oldin / Keyin')}</span>}
        {isVideo && playing && (
          <span className="gf-sc__sound" aria-hidden="true">
            <Volume2 size={13} />
          </span>
        )}
      </span>
    </Link>
  );
}
