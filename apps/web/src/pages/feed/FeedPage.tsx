import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUp, Send, ChevronDown, ChevronUp, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { cx } from '@/lib/utils';
import { env } from '@/lib/env';
import { useOpenMasterChat } from '@/features/communication/hooks/useCommunication';
import { useQuery } from '@tanstack/react-query';
import { communicationService } from '@/features/communication/services/communication.service';
import { useServiceCategories } from '@/features/service/hooks/useServices';
import { useAppStore } from '@/store/app.store';
import { CommentsSheet, useWideFeed } from '@/features/feed/components/CommentsSheet';
import { FeedItem } from '@/features/feed/components/FeedItem';
import { FeedEmpty, FeedError, FeedSkeleton, PostGone } from '@/features/feed/components/FeedStates';
import { FilterSheet } from '@/features/feed/components/FilterSheet';
import { MasterSheet } from '@/features/feed/components/MasterSheet';
import { MessagesPanel } from '@/features/feed/components/MessagesPanel';
import { MoreSheet } from '@/features/feed/components/MoreSheet';
import { SearchSheet } from '@/features/feed/components/SearchSheet';
import { ShareSheet } from '@/features/feed/components/ShareSheet';
import { useFeed, useFeedPost, useToggleFollow, useToggleLike, useToggleSave } from '@/features/feed/hooks';
import type { FeedFilters, FeedPost } from '@/features/feed/types';
import { t } from '@/i18n';
import '@/features/feed/feed.css';

const HINT_KEY = 'gm-feed-hint';

/** Professional ish lentasi: to‘liq ekranli vertikal video, ish natijasi, usta profili va xizmat buyurtmasi. */
export function FeedPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const base = env.appRole === 'MASTER' ? '/usta' : '/mijoz';
  const isMaster = env.appRole === 'MASTER';
  const toast = useAppStore((state) => state.pushToast);

  const tab = (['foryou', 'following', 'trend', 'saved'] as const).find((id) => id === params.get('bolim')) ?? 'foryou';
  const filters: FeedFilters = useMemo(() => ({ tab, category: params.get('kategoriya') ?? '', q: params.get('q') ?? '', master: params.get('usta') ?? undefined }), [tab, params]);
  const focusId = params.get('post');

  const feed = useFeed(filters);
  const categories = useServiceCategories();
  const like = useToggleLike();
  const save = useToggleSave();
  const follow = useToggleFollow();
  const openChat = useOpenMasterChat();
  const unread = useQuery({ queryKey: ['conversations', 'unread'], queryFn: () => communicationService.unreadCount(), refetchInterval: 15_000 });
  const listed = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);
  // Ulashilgan/ochilgan post ro‘yxatda bo‘lmasa, uni birinchi qilib alohida yuklaymiz.
  const single = useFeedPost(focusId && !listed.some((post) => post.id === focusId) && !feed.isLoading ? focusId : null);
  const items = useMemo(() => (single.data ? [single.data, ...listed.filter((post) => post.id !== single.data!.id)] : listed), [single.data, listed]);

  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // Ovoz tanlovi eslab qolinadi (brauzer avtopley uchun boshida ovozsiz).
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem('gm-feed-sound') !== '1';
    } catch {
      return true;
    }
  });
  const [hint, setHint] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) !== '1';
    } catch {
      return false;
    }
  });
  const [commentsFor, setCommentsFor] = useState<FeedPost | null>(null);
  const [shareFor, setShareFor] = useState<FeedPost | null>(null);
  const [moreFor, setMoreFor] = useState<FeedPost | null>(null);
  const [moreAnchor, setMoreAnchor] = useState<DOMRect | null>(null);
  const [masterFor, setMasterFor] = useState<FeedPost | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  // Faol postni aniqlash: ekranning ko‘p qismini egallagan element.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-post]'));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) setActive(nodes.indexOf(entry.target as HTMLElement));
        }
      },
      { root, threshold: [0.6] },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [items.length, filters]);

  // Oxiriga yaqinlashganda keyingi sahifa.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !feed.hasNextPage) return;
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && !feed.isFetchingNextPage && void feed.fetchNextPage(), { root: scroller.current, rootMargin: '0px 0px 120% 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [feed]);

  // Filtr o‘zgarganda yoki post ochilganda boshiga/shu postga o‘tish.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const target = focusId ? root.querySelector<HTMLElement>(`[data-post="${focusId}"]`) : null;
    if (target) target.scrollIntoView({ block: 'start' });
    else root.scrollTo({ top: 0 });
    setActive(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, focusId, single.data?.id]);

  // Klaviatura: ↑ ↓ — postlar orasida.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement;
      if (el.closest('input, textarea, [role="dialog"], select')) return;
      const root = scroller.current;
      if (!root) return;
      if (event.key === 'ArrowDown' || event.key === 'j') root.scrollBy({ top: root.clientHeight, behavior: 'smooth' });
      if (event.key === 'ArrowUp' || event.key === 'k') root.scrollBy({ top: -root.clientHeight, behavior: 'smooth' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!hint || items.length === 0) return;
    const timer = window.setTimeout(() => {
      setHint(false);
      try {
        localStorage.setItem(HINT_KEY, '1');
      } catch {
        /* ixtiyoriy */
      }
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [hint, items.length]);

  const order = useCallback(
    (post: FeedPost) => openChat.mutate(post.master.id, { onSuccess: (conversation) => navigate(`/mijoz/chat?suhbat=${conversation.id}`), onError: () => toast(t('Ustaga yozib bo‘lmadi. Qayta urinib ko‘ring.'), 'error') }),
    [openChat, navigate, toast],
  );
  const onLike = useCallback((post: FeedPost, on: boolean) => like.mutate({ id: post.id, on }), [like]);
  const onSave = useCallback((post: FeedPost, on: boolean) => save.mutate({ id: post.id, on }), [save]);
  const onFollow = useCallback((post: FeedPost, on: boolean) => follow.mutate({ masterId: post.master.id, on }), [follow]);

  const categoryName = categories.data?.find((item) => item.id === filters.category)?.name;
  const hasFilter = !!filters.category || !!filters.master;
  const wide = useWideFeed();
  const gone = !!focusId && single.isError && !listed.some((post) => post.id === focusId);

  return (
    <section className={cx('gf', items.length === 0 && !feed.isLoading && 'gf--bare', wide && commentsFor && 'gf--cp')} aria-label={t('Ish lentasi')}>
      <header className="gf-top">
        <h1 className="gf-sr">{t('Ish lentasi')}</h1>
        <span aria-hidden="true" />
        <div className="gf-top__tools">
          <button type="button" className="gf-iconbtn gf-iconbtn--glass" onClick={() => setSearchOpen(true)} aria-label={t('Qidirish')}>
            <Search size={21} aria-hidden="true" />
          </button>
          <button type="button" className={cx('gf-iconbtn gf-iconbtn--glass', (hasFilter || tab === 'saved') && 'is-on')} onClick={() => setFilterOpen(true)} aria-label={t('Filtr')}>
            <SlidersHorizontal size={21} aria-hidden="true" />
          </button>
          {isMaster && (
            <button type="button" className="gf-iconbtn gf-iconbtn--glass gf-iconbtn--add" onClick={() => navigate(`${base}/lenta/yangi`)} aria-label={t('Ish joylash')}>
              <Plus size={22} aria-hidden="true" />
            </button>
          )}
        </div>
        {(filters.q || categoryName || filters.master || tab === 'saved') && (
          <div className="gf-active" role="group" aria-label={t('Faol filtrlar')}>
            {tab === 'saved' && <button type="button" onClick={() => update({ bolim: null })}>{t('Saqlanganlar')} <X size={13} aria-hidden="true" /></button>}
            {categoryName && <button type="button" onClick={() => update({ kategoriya: null })}>{categoryName} <X size={13} aria-hidden="true" /></button>}
            {filters.q && <button type="button" onClick={() => update({ q: null })}>“{filters.q}” <X size={13} aria-hidden="true" /></button>}
            {filters.master && <button type="button" onClick={() => update({ usta: null, post: null })}>{t('Bitta usta ishlari')} <X size={13} aria-hidden="true" /></button>}
          </div>
        )}
      </header>

      <div ref={scroller} className="gf-scroller" role="feed" aria-busy={feed.isFetching} tabIndex={-1}>
        {feed.isLoading && !gone && <FeedSkeleton />}
        {feed.isError && items.length === 0 && <FeedError onRetry={() => void feed.refetch()} />}
        {gone && items.length === 0 && <PostGone onBack={() => update({ post: null })} />}
        {!feed.isLoading && !feed.isError && items.length === 0 && !gone && (
          <FeedEmpty
            tab={tab}
            hasFilter={hasFilter}
            hasQuery={!!filters.q}
            canUpload={isMaster}
            base={base}
            onReset={() => update({ q: null, kategoriya: null, usta: null, bolim: null, post: null })}
          />
        )}
        {items.map((post, index) => (
          <FeedItem
            key={post.id}
            post={post}
            active={index === active}
            mount={Math.abs(index - active) <= 1}
            muted={muted}
            canOrder={!isMaster && !post.viewer.own}
            onToggleMute={() =>
              setMuted((value) => {
                try {
                  localStorage.setItem('gm-feed-sound', value ? '1' : '0');
                } catch {
                  /* ixtiyoriy */
                }
                return !value;
              })
            }
            onLike={onLike}
            onSave={onSave}
            onFollow={onFollow}
            onComments={setCommentsFor}
            onShare={setShareFor}
            onMore={(post, rect) => {
              setMoreAnchor(rect);
              setMoreFor(post);
            }}
            onMaster={setMasterFor}
            onOrder={order}
            onTag={(tag) => update({ q: tag, post: null })}
          />
        ))}
        {feed.hasNextPage && <div ref={sentinel} className="gf-sentinel" aria-hidden="true" />}
        {feed.isFetchingNextPage && <FeedSkeleton />}
        {!feed.hasNextPage && items.length > 3 && (
          <div className="gf-end">
            <p>{t('Hozircha hammasi shu')}</p>
            <button type="button" className="gf-btn" onClick={() => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
              <ArrowUp size={16} aria-hidden="true" /> {t('Boshiga qaytish')}
            </button>
          </div>
        )}
      </div>

      {items.length > 1 && (
        <div className="gf-nav-btns">
          <button type="button" className="gf-nav-btn" disabled={active <= 0} onClick={() => scroller.current?.scrollBy({ top: -scroller.current.clientHeight, behavior: 'smooth' })} aria-label={t('Oldingi ish')}>
            <ChevronUp size={22} aria-hidden="true" />
          </button>
          <button type="button" className="gf-nav-btn" disabled={active >= items.length - 1 && !feed.hasNextPage} onClick={() => scroller.current?.scrollBy({ top: scroller.current.clientHeight, behavior: 'smooth' })} aria-label={t('Keyingi ish')}>
            <ChevronDown size={22} aria-hidden="true" />
          </button>
        </div>
      )}
      {hint && items.length > 0 && (
        <div className="gf-hint" role="note" aria-live="polite">
          <ArrowUp size={16} aria-hidden="true" /> {t('Keyingi ish uchun yuqoriga suring')}
        </div>
      )}
      <button type="button" className="gf-msg" onClick={() => setMessagesOpen((value) => !value)} aria-expanded={messagesOpen}>
        <Send size={20} aria-hidden="true" /> {t('Xabarlar')}
        {(unread.data?.count ?? 0) > 0 && <em>{unread.data?.count}</em>}
      </button>
      <MessagesPanel open={messagesOpen} onClose={() => setMessagesOpen(false)} />
      {openChat.isPending && <div className="gf-toast" role="status">{t('Chat ochilmoqda…')}</div>}

      <CommentsSheet post={commentsFor ? (items.find((post) => post.id === commentsFor.id) ?? commentsFor) : null} onClose={() => setCommentsFor(null)} />
      <ShareSheet post={shareFor} onClose={() => setShareFor(null)} />
      <MoreSheet anchor={moreAnchor} onShare={setShareFor} post={moreFor ? (items.find((post) => post.id === moreFor.id) ?? moreFor) : null} base={base} onClose={() => setMoreFor(null)} onMaster={setMasterFor} />
      <MasterSheet
        post={masterFor ? (items.find((post) => post.id === masterFor.id) ?? masterFor) : null}
        canOrder={!isMaster && !masterFor?.viewer.own}
        onClose={() => setMasterFor(null)}
        onOrder={order}
        onOpenPost={(post) => {
          setMasterFor(null);
          update({ usta: post.master.id, post: post.id, bolim: null, q: null, kategoriya: null });
        }}
      />
      <FilterSheet
        open={filterOpen}
        category={filters.category}
        saved={tab === 'saved'}
        onClose={() => setFilterOpen(false)}
        onCategory={(id) => update({ kategoriya: id || null, post: null })}
        onSaved={(on) => update({ bolim: on ? 'saved' : null, post: null })}
      />
      <SearchSheet
        open={searchOpen}
        canFindMasters={!isMaster}
        onClose={() => setSearchOpen(false)}
        onPickQuery={(q) => {
          setSearchOpen(false);
          update({ q, post: null, bolim: tab === 'saved' ? null : params.get('bolim') });
        }}
        onPickPost={(post) => {
          setSearchOpen(false);
          update({ post: post.id });
        }}
        onPickMaster={(accountNumber) => navigate(`/mijoz/ustalar/${accountNumber}`)}
        onPickCategory={(id) => {
          setSearchOpen(false);
          update({ kategoriya: id, q: null, post: null });
        }}
      />
    </section>
  );
}
