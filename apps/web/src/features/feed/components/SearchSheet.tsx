import { useEffect, useRef, useState } from 'react';
import { Clock, Search, SearchX, X } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { useServiceCategories } from '@/features/service/hooks/useServices';
import { useMasters } from '@/features/master/hooks/useMaster';
import { initials } from '../format';
import { t } from '@/i18n';
import { useFeed } from '../hooks';
import type { FeedPost } from '../types';
import { PostThumb } from './PostThumb';
import { Sheet } from './Sheet';

const KEY = 'gm-feed-recent';
const readRecent = (): string[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string').slice(0, 6) : [];
  } catch {
    return [];
  }
};
const saveRecent = (list: string[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 6)));
  } catch {
    /* ixtiyoriy */
  }
};

/** Qidiruv: usta, xizmat, kasb, video va kategoriya bo‘yicha; natijalar yozish davomida chiqadi. */
export function SearchSheet({ open, canFindMasters, onClose, onPickQuery, onPickPost, onPickMaster, onPickCategory }: { open: boolean; canFindMasters: boolean; onClose: () => void; onPickQuery: (q: string) => void; onPickPost: (post: FeedPost) => void; onPickMaster: (accountNumber: number) => void; onPickCategory: (id: string) => void }) {
  const [text, setText] = useState('');
  const [recent, setRecent] = useState<string[]>(readRecent);
  const q = useDebounce(text.trim(), 250);
  const input = useRef<HTMLInputElement>(null);
  const categories = useServiceCategories();
  const posts = useFeed({ tab: 'foryou', category: '', q });
  const masters = useMasters(canFindMasters ? q : '');
  const postItems = q ? (posts.data?.pages[0]?.items ?? []) : [];
  const masterItems = canFindMasters && q ? (masters.data?.pages[0]?.items ?? []).slice(0, 4) : [];
  const catMatches = q ? (categories.data ?? []).filter((item) => item.name.toLowerCase().includes(q.toLowerCase())).slice(0, 4) : [];
  const loading = !!q && (posts.isFetching || masters.isFetching) && postItems.length === 0 && masterItems.length === 0;
  const empty = !!q && !loading && postItems.length === 0 && masterItems.length === 0 && catMatches.length === 0;

  useEffect(() => {
    if (open) window.setTimeout(() => input.current?.focus(), 60);
    else setText('');
  }, [open]);

  const remember = (value: string) => {
    const next = [value, ...recent.filter((item) => item !== value)].slice(0, 6);
    setRecent(next);
    saveRecent(next);
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('Qidirish')} tall>
      <form
        className="gf-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim()) return;
          remember(text.trim());
          onPickQuery(text.trim());
        }}
      >
        <Search size={18} aria-hidden="true" />
        <input ref={input} type="search" value={text} maxLength={80} onChange={(event) => setText(event.target.value)} placeholder={t('Usta, xizmat yoki kasb qidiring…')} aria-label={t('Qidirish')} />
        {text && (
          <button type="button" className="gf-iconbtn gf-iconbtn--sm" onClick={() => setText('')} aria-label={t('Tozalash')}>
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </form>

      {!q && (
        <>
          {recent.length > 0 && (
            <section aria-label={t('So‘nggi qidiruvlar')}>
              <div className="gf-row-between">
                <h3 className="gf-h3">{t('So‘nggi qidiruvlar')}</h3>
                <button type="button" className="gf-linkbtn" onClick={() => { setRecent([]); saveRecent([]); }}>
                  {t('Tozalash')}
                </button>
              </div>
              <ul className="gf-recentlist">
                {recent.map((item) => (
                  <li key={item}>
                    <button type="button" onClick={() => onPickQuery(item)}>
                      <Clock size={16} aria-hidden="true" /> {item}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-label={t('Mashhur yo‘nalishlar')}>
            <h3 className="gf-h3">{t('Mashhur yo‘nalishlar')}</h3>
            <div className="gf-chips">
              {(categories.data ?? []).slice(0, 10).map((item) => (
                <button key={item.id} type="button" className="gf-chipbtn" onClick={() => onPickCategory(item.id)}>
                  {item.name}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {loading && (
        <ul className="gf-skel-list" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="gf-skel gf-skel--row" />
          ))}
        </ul>
      )}
      {empty && (
        <div className="gf-empty gf-empty--sm">
          <SearchX size={30} aria-hidden="true" />
          <strong>{t('Hech narsa topilmadi')}</strong>
          <p>{t('Boshqa so‘z bilan urinib ko‘ring yoki kategoriyani tanlang.')}</p>
        </div>
      )}
      {catMatches.length > 0 && (
        <section aria-label={t('Kategoriyalar')}>
          <h3 className="gf-h3">{t('Kategoriyalar')}</h3>
          <div className="gf-chips">
            {catMatches.map((item) => (
              <button key={item.id} type="button" className="gf-chipbtn" onClick={() => onPickCategory(item.id)}>
                {item.name}
              </button>
            ))}
          </div>
        </section>
      )}
      {masterItems.length > 0 && (
        <section aria-label={t('Ustalar')}>
          <h3 className="gf-h3">{t('Ustalar')}</h3>
          <ul className="gf-people">
            {masterItems.map((item) => {
              const name = [item.user.firstName, item.user.lastName].filter(Boolean).join(' ') || `Usta #${item.user.accountNumber}`;
              return (
                <li key={item.id}>
                  <button type="button" className="gf-person" onClick={() => item.user.accountNumber != null && onPickMaster(item.user.accountNumber)}>
                    <span className="gf-avatar gf-avatar--sm" aria-hidden="true">{initials(name)}</span>
                    <span>
                      <strong>{name}</strong>
                      <small>{item.profession ?? t('Usta')}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {postItems.length > 0 && (
        <section aria-label={t('Videolar va ishlar')}>
          <h3 className="gf-h3">{t('Videolar va ishlar')}</h3>
          <ul className="gf-grid gf-grid--sm">
            {postItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="gf-tile"
                  onClick={() => {
                    remember(text.trim());
                    onPickPost(item);
                  }}
                  aria-label={item.caption ?? item.master.name}
                >
                  <PostThumb post={item} />
                  <span className="gf-tile__views">{item.master.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Sheet>
  );
}
