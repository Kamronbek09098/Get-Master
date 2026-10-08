import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { BadgeCheck, Bookmark, CalendarCheck, Ellipsis, Heart, MessageCircle, Play, RotateCw, Send, Star, Volume2, VolumeX, WifiOff, Wrench } from 'lucide-react';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import { clock, compact, initials } from '../format';
import { feedService } from '../feed.service';
import { useStableUrl } from '../useStableUrl';
import type { FeedPost } from '../types';
import { BeforeAfter } from './BeforeAfter';

export interface FeedItemProps {
  post: FeedPost;
  active: boolean;
  /** Video elementi faqat faol va qo‘shni postlar uchun yuklanadi (xotira va trafikni tejaydi). */
  mount: boolean;
  muted: boolean;
  canOrder: boolean;
  onToggleMute: () => void;
  onLike: (post: FeedPost, on: boolean) => void;
  onSave: (post: FeedPost, on: boolean) => void;
  onFollow: (post: FeedPost, on: boolean) => void;
  onComments: (post: FeedPost) => void;
  onShare: (post: FeedPost) => void;
  onMore: (post: FeedPost) => void;
  onMaster: (post: FeedPost) => void;
  onOrder: (post: FeedPost) => void;
  onTag: (tag: string) => void;
}

const DOUBLE_TAP_MS = 260;
const HOLD_MS = 320;

function FeedItemBase(props: FeedItemProps) {
  const { post, active, mount, muted, canOrder } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const viewed = useRef(false);
  const tap = useRef<{ timer: number | null; last: number }>({ timer: null, last: 0 });
  const hold = useRef<{ timer: number | null; held: boolean; moved: boolean; x: number; y: number }>({ timer: null, held: false, moved: false, x: 0, y: 0 });
  const [paused, setPaused] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [burst, setBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [sliding, setSliding] = useState(false);
  const isVideo = post.kind === 'VIDEO';
  const longCaption = (post.caption?.length ?? 0) > 90;
  const likeRef = useRef(post.viewer.liked);
  likeRef.current = post.viewer.liked;

  // Faol bo‘lsa — ijro, aks holda — to‘xtatish (faqat bitta video ishlaydi).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active && !paused) void video.play().catch(() => undefined);
    else video.pause();
    if (!active) {
      video.currentTime = 0;
      setPaused(false);
      setExpanded(false);
    }
  }, [active, paused, mount, attempt]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted, mount]);

  // Boshqa oynaga o‘tilganda video to‘xtaydi (batareya va trafik), qaytganda davom etadi.
  useEffect(() => {
    if (!active) return;
    const onVisibility = () => {
      const video = videoRef.current;
      if (!video) return;
      if (document.hidden) video.pause();
      else if (!paused) void video.play().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [active, paused]);

  // 2 soniya ko‘rilgan post «ko‘rildi» deb hisoblanadi (bir marta).
  useEffect(() => {
    if (!active || viewed.current) return;
    const timer = window.setTimeout(() => {
      viewed.current = true;
      void feedService.view(post.id).catch(() => undefined);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [active, post.id]);

  const onTime = useCallback(() => {
    const video = videoRef.current;
    if (video && barRef.current && video.duration > 0) barRef.current.style.transform = `scaleX(${(video.currentTime / video.duration).toFixed(4)})`;
  }, []);

  const like = () => {
    if (!likeRef.current) props.onLike(post, true);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isVideo || (event.target as HTMLElement).closest('button, a')) return;
    hold.current = { timer: null, held: false, moved: false, x: event.clientX, y: event.clientY };
    hold.current.timer = window.setTimeout(() => {
      hold.current.held = true;
      videoRef.current?.pause();
    }, HOLD_MS);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (Math.abs(event.clientX - hold.current.x) + Math.abs(event.clientY - hold.current.y) > 10) {
      hold.current.moved = true;
      if (hold.current.timer) window.clearTimeout(hold.current.timer);
    }
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isVideo || (event.target as HTMLElement).closest('button, a')) return;
    if (hold.current.timer) window.clearTimeout(hold.current.timer);
    if (hold.current.held) {
      hold.current.held = false;
      if (!paused) void videoRef.current?.play().catch(() => undefined);
      return;
    }
    if (hold.current.moved) return;
    const now = performance.now();
    if (now - tap.current.last < DOUBLE_TAP_MS) {
      if (tap.current.timer) window.clearTimeout(tap.current.timer);
      tap.current.last = 0;
      const rect = event.currentTarget.getBoundingClientRect();
      setBurst({ x: event.clientX - rect.left, y: event.clientY - rect.top, id: now });
      like();
      return;
    }
    tap.current.last = now;
    tap.current.timer = window.setTimeout(() => setPaused((value) => !value), DOUBLE_TAP_MS);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === ' ' || event.key === 'k') {
      event.preventDefault();
      if (isVideo) setPaused((value) => !value);
    } else if (event.key === 'm') props.onToggleMute();
    else if (event.key === 'l') props.onLike(post, !post.viewer.liked);
  };

  const m = post.master;
  const media = {
    videoUrl: useStableUrl(post.media.videoUrl),
    coverUrl: useStableUrl(post.media.coverUrl),
    beforeUrl: useStableUrl(post.media.beforeUrl),
    afterUrl: useStableUrl(post.media.afterUrl),
  };
  const verifiedLabel = t('Tasdiqlangan usta');

  return (
    <article className="gf-item" data-post={post.id} aria-label={`${m.name}: ${post.caption ?? post.service?.name ?? t('Bajarilgan ish')}`} tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="gf-stage" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => hold.current.timer && window.clearTimeout(hold.current.timer)}>
        {/* Media */}
        {isVideo && media.videoUrl && mount && !failed && (
          <video
            key={attempt}
            ref={videoRef}
            className="gf-media"
            src={media.videoUrl}
            poster={media.coverUrl ?? undefined}
            loop
            muted={muted}
            playsInline
            preload={active ? 'auto' : 'metadata'}
            onTimeUpdate={onTime}
            onWaiting={() => setBuffering(true)}
            onPlaying={() => setBuffering(false)}
            onCanPlay={() => setBuffering(false)}
            onError={() => setFailed(true)}
            aria-label={post.caption ?? m.name}
          />
        )}
        {isVideo && (!mount || !media.videoUrl) && media.coverUrl && !failed && <img className="gf-media" src={media.coverUrl} alt="" draggable={false} />}
        {isVideo && !media.coverUrl && !mount && <div className="gf-media gf-media--blank" />}
        {post.kind === 'BEFORE_AFTER' && media.beforeUrl && media.afterUrl && <BeforeAfter before={media.beforeUrl} after={media.afterUrl} alt={post.caption ?? m.name} onDragState={setSliding} />}
        {post.kind === 'PHOTO' && media.afterUrl && <img className="gf-media" src={media.afterUrl} alt={post.caption ?? m.name} draggable={false} />}

        <div className="gf-scrim gf-scrim--top" aria-hidden="true" />
        <div className="gf-scrim gf-scrim--bottom" aria-hidden="true" />

        {/* Holat belgilari */}
        {buffering && !failed && active && <span className="gf-spinner" role="status" aria-label={t('Video yuklanmoqda')} />}
        {paused && isVideo && !failed && (
          <span className="gf-pause" aria-hidden="true">
            <Play size={34} fill="currentColor" />
          </span>
        )}
        {burst && (
          <span key={burst.id} className="gf-burst" style={{ left: burst.x, top: burst.y }} aria-hidden="true" onAnimationEnd={() => setBurst(null)}>
            <Heart size={84} fill="currentColor" />
          </span>
        )}
        {failed && (
          <div className="gf-fail" role="alert">
            <WifiOff size={30} aria-hidden="true" />
            <strong>{t('Videoni ochib bo‘lmadi')}</strong>
            <p>{t('Internet aloqasini tekshiring yoki qayta urinib ko‘ring.')}</p>
            <button
              type="button"
              className="gf-btn gf-btn--ghost"
              onClick={() => {
                setFailed(false);
                setAttempt((value) => value + 1);
              }}
            >
              <RotateCw size={16} aria-hidden="true" /> {t('Qayta urinish')}
            </button>
          </div>
        )}

        {/* Yuqori o‘ng: ovoz va davomiylik */}
        {isVideo && !failed && (
          <div className="gf-topright">
            {post.durationSec ? <span className="gf-chip gf-chip--dur">{clock(post.durationSec)}</span> : null}
            <button type="button" className="gf-iconbtn gf-iconbtn--glass" onClick={props.onToggleMute} aria-pressed={!muted} aria-label={muted ? t('Ovozni yoqish') : t('Ovozni o‘chirish')}>
              {muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
            </button>
          </div>
        )}

        {/* O‘ng harakatlar paneli */}
        <div className="gf-rail" role="group" aria-label={t('Harakatlar')}>
          <button type="button" className={cx('gf-act', post.viewer.liked && 'is-on gf-act--like')} aria-pressed={post.viewer.liked} aria-label={t('Yoqdi: {count}', { count: post.counts.likes })} onClick={() => props.onLike(post, !post.viewer.liked)}>
            <Heart size={27} fill={post.viewer.liked ? 'currentColor' : 'none'} aria-hidden="true" />
            <span>{compact(post.counts.likes)}</span>
          </button>
          <button type="button" className="gf-act" aria-label={t('Izohlar: {count}', { count: post.counts.comments })} onClick={() => props.onComments(post)}>
            <MessageCircle size={27} aria-hidden="true" />
            <span>{compact(post.counts.comments)}</span>
          </button>
          <button type="button" className="gf-act" aria-label={t('Ulashish')} onClick={() => props.onShare(post)}>
            <Send size={26} aria-hidden="true" />
            <span>{compact(post.counts.shares)}</span>
          </button>
          <button type="button" className={cx('gf-act', post.viewer.saved && 'is-on gf-act--save')} aria-pressed={post.viewer.saved} aria-label={t('Saqlash: {count}', { count: post.counts.saves })} onClick={() => props.onSave(post, !post.viewer.saved)}>
            <Bookmark size={27} fill={post.viewer.saved ? 'currentColor' : 'none'} aria-hidden="true" />
            <span>{compact(post.counts.saves)}</span>
          </button>
          <button type="button" className="gf-act" aria-label={t('Yana')} onClick={() => props.onMore(post)}>
            <Ellipsis size={27} aria-hidden="true" />
          </button>
        </div>

        {/* Pastki: usta, tavsif, CTA */}
        <div className="gf-info">
          <div className="gf-creator">
            <button type="button" className="gf-avatar" onClick={() => props.onMaster(post)} aria-label={t('{name} profilini ochish', { name: m.name })}>
              {initials(m.name)}
            </button>
            <button type="button" className="gf-creator__id" onClick={() => props.onMaster(post)}>
              <strong>
                {m.name}
                {m.verified && <BadgeCheck size={16} className="gf-verified" aria-label={verifiedLabel} />}
                {m.isPro && <span className="gf-pro">Pro</span>}
              </strong>
              <span>
                <Star size={12} fill="currentColor" aria-hidden="true" /> {m.ratingCount > 0 ? m.ratingAvg.toFixed(1) : t('Yangi')} · {t('{count} ta ish', { count: m.completedOrders })}
              </span>
              {(post.category || m.profession) && (
                <span className="gf-creator__job">
                  <Wrench size={12} aria-hidden="true" /> {post.category?.name ?? m.profession}
                </span>
              )}
            </button>
            {!post.viewer.own && (
              <button type="button" className={cx('gf-follow', post.viewer.following && 'is-on')} aria-pressed={post.viewer.following} onClick={() => props.onFollow(post, !post.viewer.following)}>
                {post.viewer.following ? t('Kuzatilmoqda') : t('Kuzatish')}
              </button>
            )}
          </div>

          {post.caption && (
            <p className={cx('gf-caption', expanded && 'is-open')}>
              {post.caption}
              {longCaption && !expanded && (
                <button type="button" className="gf-more" onClick={() => setExpanded(true)}>
                  {t('… yana')}
                </button>
              )}
            </p>
          )}
          {(post.tags.length > 0 || post.service) && (
            <ul className="gf-tags" aria-label={t('Teglar')}>
              {post.service && <li className="gf-tag gf-tag--svc">{post.service.name}</li>}
              {post.tags.slice(0, 4).map((tag) => (
                <li key={tag}>
                  <button type="button" className="gf-tag" onClick={() => props.onTag(tag)}>
                    #{tag}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {canOrder ? (
            <button type="button" className="gf-cta" onClick={() => props.onOrder(post)}>
              <CalendarCheck size={19} aria-hidden="true" /> {post.service ? t('Shu xizmatni buyurtma qilish') : t('Ustani chaqirish')}
            </button>
          ) : (
            <p className="gf-insight">
              {t('{views} ko‘rish', { views: compact(post.counts.views) })} · {t('{likes} yoqdi', { likes: compact(post.counts.likes) })}
            </p>
          )}
        </div>

        {isVideo && !failed && (
          <span className="gf-progress" aria-hidden="true">
            <i ref={barRef} />
          </span>
        )}
        {paused && isVideo && <span className="gf-sr" role="status">{t('Pauza')}</span>}
        {sliding && <span className="gf-sr" role="status">{t('Oldin va keyin taqqoslanmoqda')}</span>}
      </div>
    </article>
  );
}

export const FeedItem = memo(FeedItemBase);
