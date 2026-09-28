import { useState } from 'react';
import { Search } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { getErrorMessage } from '@/lib/error-messages';
import { useDebounce } from '@/hooks/useDebounce';
import { useMasters } from '@/features/master/hooks/useMaster';
import { MasterCard } from '@/features/master/components/MasterCard';
import { useServiceCategories } from '@/features/service/hooks/useServices';
import '@/features/master/components/MasterCatalog.css';

export function MasterPage() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const debouncedSearch = useDebounce(search, 400);
  const categories = useServiceCategories();
  const masters = useMasters(debouncedSearch, categoryId);
  const items = masters.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = !!debouncedSearch || !!categoryId;

  return (
    <div>
      <div className="gm-masters-head">
        <h1>Ustalar katalogi</h1>
        <p>Tasdiqlangan ustalarni tanlang, profilini ko‘ring va chat orqali bog‘laning.</p>
      </div>

      <div className="gm-masters-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          aria-label="Usta qidirish"
          placeholder="Ism, kasb yoki ID bo‘yicha qidiring"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {(categories.data?.length ?? 0) > 0 && (
        <div className="gm-masters-chips" role="group" aria-label="Kategoriyalar">
          <button type="button" className="gm-masters-chip" aria-pressed={!categoryId} onClick={() => setCategoryId(undefined)}>
            Barchasi
          </button>
          {categories.data?.map((category) => (
            <button
              key={category.id}
              type="button"
              className="gm-masters-chip"
              aria-pressed={categoryId === category.id}
              onClick={() => setCategoryId(categoryId === category.id ? undefined : category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      {masters.isError && <Alert tone="danger">{getErrorMessage(masters.error)}</Alert>}
      {masters.isLoading && (
        <div className="gm-masters-grid">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="gm-master-skeleton" />
          ))}
        </div>
      )}
      {!masters.isLoading && !masters.isError && items.length === 0 && (
        <EmptyState
          title="Usta topilmadi"
          description={filtered ? 'Qidiruv yoki kategoriyani o‘zgartirib ko‘ring.' : 'Hozircha tasdiqlangan ustalar yo‘q.'}
        />
      )}
      {items.length > 0 && (
        <>
          <p className="gm-masters-count">{items.length} ta usta{masters.hasNextPage ? '+' : ''}</p>
          <div className="gm-masters-grid">
            {items.map((master) => (
              <MasterCard key={master.id} master={master} />
            ))}
          </div>
          <Pagination
            hasMore={!!masters.hasNextPage}
            loading={masters.isFetchingNextPage}
            onLoadMore={() => void masters.fetchNextPage()}
          />
        </>
      )}
    </div>
  );
}
