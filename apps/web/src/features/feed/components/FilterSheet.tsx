import { useState } from 'react';
import { Bookmark, LayoutGrid, Search } from 'lucide-react';
import { useServiceCategories } from '@/features/service/hooks/useServices';
import { categoryIcon } from '@/features/service/category-icon';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import { Sheet } from './Sheet';

/** Kasb bo‘yicha filtr: qidiruv va ikonali kategoriya to‘ri; tanlansa lenta shu kategoriya bilan cheklanadi. */
export function FilterSheet({ open, category, saved, onClose, onCategory, onSaved }: { open: boolean; category: string; saved: boolean; onClose: () => void; onCategory: (id: string) => void; onSaved: (on: boolean) => void }) {
  const categories = useServiceCategories();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const list = (categories.data ?? []).filter((item) => !needle || item.name.toLowerCase().includes(needle));
  return (
    <Sheet open={open} onClose={onClose} title={t('Kasb bo‘yicha filtrlash')} subtitle={t('Kerakli yo‘nalishni tanlang')}
      footer={
        <button type="button" className="gf-cta gf-cta--sheet" onClick={onClose}>
          {t('Natijalarni ko‘rsatish')}
        </button>
      }
    >
      <div className="gf-filter">
        <label className="gf-filter__search">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Kasb yoki xizmatni qidiring...')} aria-label={t('Kasb yoki xizmatni qidiring...')} />
        </label>
        <ul className="gf-catgrid" aria-label={t('Kategoriyalar')}>
          {!needle && (
            <li>
              <button type="button" className={cx('gf-cat', !category && 'is-on')} aria-pressed={!category} onClick={() => onCategory('')}>
                <span className="gf-cat__ico"><LayoutGrid size={22} aria-hidden="true" /></span>
                <span className="gf-cat__name">{t('Barchasi')}</span>
              </button>
            </li>
          )}
          {categories.isLoading && [0, 1, 2, 3].map((i) => <li key={i}><span className="gf-skel gf-skel--tile" aria-hidden="true" /></li>)}
          {list.map((item) => {
            const Icon = categoryIcon(item.name);
            return (
              <li key={item.id}>
                <button type="button" className={cx('gf-cat', category === item.id && 'is-on')} aria-pressed={category === item.id} onClick={() => onCategory(category === item.id ? '' : item.id)}>
                  <span className="gf-cat__ico"><Icon size={22} aria-hidden="true" /></span>
                  <span className="gf-cat__name">{item.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {!categories.isLoading && !categories.isError && list.length === 0 && <p className="gf-note">{t('Hech narsa topilmadi')}</p>}
        {categories.isError && <p className="gf-note gf-note--err" role="alert">{t('Kategoriyalarni yuklab bo‘lmadi.')}</p>}
        <button type="button" className={cx('gf-chipbtn gf-chipbtn--wide', saved && 'is-on')} aria-pressed={saved} onClick={() => onSaved(!saved)}>
          <Bookmark size={16} aria-hidden="true" /> {t('Saqlanganlar')}
        </button>
      </div>
    </Sheet>
  );
}
