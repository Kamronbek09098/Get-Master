import { Bookmark, Check } from 'lucide-react';
import { useServiceCategories } from '@/features/service/hooks/useServices';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';
import { Sheet } from './Sheet';

/** Kasb bo‘yicha filtr: ixcham «chip»lar; tanlansa lenta shu kategoriya bilan cheklanadi. */
export function FilterSheet({ open, category, saved, onClose, onCategory, onSaved }: { open: boolean; category: string; saved: boolean; onClose: () => void; onCategory: (id: string) => void; onSaved: (on: boolean) => void }) {
  const categories = useServiceCategories();
  return (
    <Sheet open={open} onClose={onClose} title={t('Kasb bo‘yicha filtrlash')} subtitle={t('Kerakli yo‘nalishni tanlang')}>
      <div className="gf-filter">
        <button type="button" className={cx('gf-chipbtn gf-chipbtn--wide', saved && 'is-on')} aria-pressed={saved} onClick={() => onSaved(!saved)}>
          <Bookmark size={16} aria-hidden="true" /> {t('Saqlanganlar')}
        </button>
        <div className="gf-chips" role="group" aria-label={t('Kategoriyalar')}>
          <button type="button" className={cx('gf-chipbtn', !category && 'is-on')} aria-pressed={!category} onClick={() => onCategory('')}>
            {t('Barchasi')}
          </button>
          {categories.isLoading && [0, 1, 2, 3, 4].map((i) => <span key={i} className="gf-skel gf-skel--chip" aria-hidden="true" />)}
          {(categories.data ?? []).map((item) => (
            <button key={item.id} type="button" className={cx('gf-chipbtn', category === item.id && 'is-on')} aria-pressed={category === item.id} onClick={() => onCategory(category === item.id ? '' : item.id)}>
              {category === item.id && <Check size={14} aria-hidden="true" />} {item.name}
            </button>
          ))}
        </div>
        {categories.isError && <p className="gf-note gf-note--err" role="alert">{t('Kategoriyalarni yuklab bo‘lmadi.')}</p>}
        <button type="button" className="gf-cta gf-cta--sheet" onClick={onClose}>
          {t('Natijalarni ko‘rsatish')}
        </button>
      </div>
    </Sheet>
  );
}
