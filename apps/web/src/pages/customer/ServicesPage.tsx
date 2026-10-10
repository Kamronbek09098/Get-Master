import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, ChevronDown, ChevronLeft, ChevronRight, Clock, Filter, LayoutGrid, MapPin, Search, ShieldCheck, Star, Tag, Users, X } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatMoney, formatNumber } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { RegionSelect } from '@/features/public/RegionSelect';
import { usePublicRegions, usePublicServices, usePublicStats } from '@/features/public/hooks';
import type { CatalogFilters } from '@/features/public/public.service';
import { ServiceArt, categoryIcon, categoryPalette } from '@/features/catalog/service-art';
import { pageNumbers } from '@/features/admin/users/users-ui';
import { t } from '@/i18n';
import './ServicesPage.css';

const PAGE_SIZE = 9;
type Sort = NonNullable<CatalogFilters['sort']>;
const SORTS: Array<{ value: Sort; label: string }> = [
  { value: 'popular', label: t('Omabop') },
  { value: 'price_asc', label: t('Narx: arzondan qimmatga') },
  { value: 'price_desc', label: t('Narx: qimmatdan arzonga') },
  { value: 'rating', label: t('Reyting bo‘yicha') },
  { value: 'name', label: t('Nomi bo‘yicha') },
];
const PRICE_PRESETS: Array<{ key: string; label: string; min?: number; max?: number }> = [
  { key: '', label: t('Barcha narxlar') },
  { key: 'p1', label: t('100 000 so‘mgacha'), max: 100_000 },
  { key: 'p2', label: t('100 000 — 300 000'), min: 100_000, max: 300_000 },
  { key: 'p3', label: t('300 000 — 600 000'), min: 300_000, max: 600_000 },
  { key: 'p4', label: t('600 000 dan yuqori'), min: 600_000 },
];
const RATINGS: Array<{ value: number; key: 'r45' | 'r40' | 'r35'; label: string }> = [
  { value: 4.5, key: 'r45', label: '4.5+' },
  { value: 4, key: 'r40', label: '4.0+' },
  { value: 3.5, key: 'r35', label: '3.5+' },
];
const digits = (value: string) => value.replace(/\D/g, '');

/** Xizmatlar katalogi: kategoriya, hudud, narx, ustalar soni va reyting bo‘yicha filtrlar; hammasi ustalarning haqiqiy ma’lumotlaridan hisoblanadi. */
export function ServicesPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [region, setRegion] = useState('');
  const [price, setPrice] = useState<{ min?: number; max?: number }>({});
  const [masters, setMasters] = useState<'' | '1' | '2-3' | '4+'>('');
  const [rating, setRating] = useState<number | undefined>();
  const [available, setAvailable] = useState(false);
  const [sort, setSort] = useState<Sort>('popular');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [allCategories, setAllCategories] = useState(false);
  const debouncedSearch = useDebounce(search, 350);

  const filters = useMemo<CatalogFilters>(
    () => ({ q: debouncedSearch || undefined, categories: selected.length ? selected : undefined, region: region || undefined, minPrice: price.min, maxPrice: price.max, masters: masters || undefined, minRating: rating, available: available || undefined, sort }),
    [debouncedSearch, selected, region, price, masters, rating, available, sort],
  );
  const catalog = usePublicServices(filters, page, PAGE_SIZE);
  // Kategoriyalar qatori filtrdan mustaqil: har doim barcha kategoriyalar ko‘rinib turadi.
  const everything = usePublicServices({}, 1, 1);
  const stats = usePublicStats();
  const regions = usePublicRegions();
  const data = catalog.data;
  const facets = data?.facets;
  const allFacetCategories = everything.data?.facets.categories ?? [];

  useEffect(() => setPage(1), [filters]);

  const priceBounds = facets?.price ?? { min: 0, max: 0 };
  const hasBounds = priceBounds.max > priceBounds.min;
  const sliderMin = price.min ?? priceBounds.min;
  const sliderMax = price.max ?? priceBounds.max;
  const categoryName = (id: string) => allFacetCategories.find((item) => item.id === id)?.name ?? id;
  const regionLabel = regions.data?.find((item) => item.key === region)?.name;
  const presetKey = PRICE_PRESETS.find((preset) => preset.min === price.min && preset.max === price.max)?.key;

  const chips: Array<{ key: string; label: string; clear: () => void }> = [
    ...selected.map((id) => ({ key: `c${id}`, label: categoryName(id), clear: () => setSelected(selected.filter((item) => item !== id)) })),
    ...(region ? [{ key: 'region', label: regionLabel ?? region, clear: () => setRegion('') }] : []),
    ...(price.min !== undefined || price.max !== undefined ? [{ key: 'price', label: `${price.min !== undefined ? formatNumber(price.min) : '0'} – ${price.max !== undefined ? formatNumber(price.max) : '∞'}`, clear: () => setPrice({}) }] : []),
    ...(masters ? [{ key: 'masters', label: t('{count} usta', { count: masters }), clear: () => setMasters('') }] : []),
    ...(rating !== undefined ? [{ key: 'rating', label: `★ ${rating}+`, clear: () => setRating(undefined) }] : []),
    ...(available ? [{ key: 'available', label: t('Mavjud ustalar'), clear: () => setAvailable(false) }] : []),
    ...(debouncedSearch ? [{ key: 'q', label: `“${debouncedSearch}”`, clear: () => setSearch('') }] : []),
  ];
  const reset = () => {
    setSearch('');
    setSelected([]);
    setRegion('');
    setPrice({});
    setMasters('');
    setRating(undefined);
    setAvailable(false);
  };
  const toggleCategory = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const visibleCategories = (facets?.categories ?? []).filter((item) => item.name.toLowerCase().includes(categorySearch.trim().toLowerCase()));
  const shownCategories = allCategories || categorySearch ? visibleCategories : visibleCategories.slice(0, 6);
  const filterCount = [selected.length > 0, !!region, price.min !== undefined || price.max !== undefined, !!masters, rating !== undefined, available].filter(Boolean).length;

  return (
    <div className="gm-svc">
      <nav className="gm-svc__crumbs" aria-label={t('Sahifa yo‘li')}>
        <Link to="/mijoz/lenta">{t('Bosh sahifa')}</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span>{t('Xizmatlar')}</span>
      </nav>
      <div className="gm-page-header">
        <div>
          <h1>{t('Xizmatlar')}</h1>
          <p className="gm-page-lead">{t('O‘zingizga kerakli xizmatni tanlang va professional ustalardan buyurtma bering')}</p>
        </div>
      </div>

      <section className="gm-svc__hero">
        <div>
          <span className="gm-svc__brand">GetMaster</span>
          <h2>{t('Ishingizni ishonchli ustalarga topshiring')}</h2>
          <p>{t('Sizga eng yaqin va eng yaxshi ustalar bilan tez va qulay xizmat ko‘rsatamiz.')}</p>
          <ul>
            <li><BadgeCheck size={15} aria-hidden="true" /> {t('Tekshirilgan ustalar')}</li>
            <li><Tag size={15} aria-hidden="true" /> {t('Qulay narxlar')}</li>
            <li><Clock size={15} aria-hidden="true" /> {t('Tezkor xizmat')}</li>
            <li><ShieldCheck size={15} aria-hidden="true" /> {t('Kafolat')}</li>
          </ul>
        </div>
        <div className="gm-svc__heroart" aria-hidden="true">
          {allFacetCategories.slice(0, 4).map((item, index) => {
            const Icon = categoryIcon(item.name);
            const palette = categoryPalette(item.id);
            return <span key={item.id} className={`is-${index}`} style={{ background: palette.a, color: palette.fg }}><Icon size={30} strokeWidth={1.8} /></span>;
          })}
          {stats.data && stats.data.completedOrders > 0 && (
            <div className="gm-svc__proof"><strong>{formatNumber(stats.data.completedOrders)}+</strong><small>{t('Bajarilgan buyurtmalar')}</small></div>
          )}
        </div>
      </section>

      <div className="gm-svc__tiles" role="group" aria-label={t('Kategoriyalar')}>
        <button type="button" aria-pressed={selected.length === 0} className={cx(selected.length === 0 && 'is-active')} onClick={() => setSelected([])}>
          <span className="gm-svc__tileicon gm-svc__tileicon--all"><LayoutGrid size={22} /></span>
          <b>{t('Barchasi')}</b>
        </button>
        {allFacetCategories.map((item) => (
          <button key={item.id} type="button" aria-pressed={selected.length === 1 && selected[0] === item.id} className={cx(selected.includes(item.id) && 'is-active')} onClick={() => setSelected(selected.length === 1 && selected[0] === item.id ? [] : [item.id])}>
            <ServiceArt categoryId={item.id} categoryName={item.name} size="tile" />
            <b>{item.name}</b>
          </button>
        ))}
      </div>

      <div className="gm-svc__layout">
        <div className="gm-svc__main">
          <div className="gm-svc__bar">
            <label className="gm-svc__search">
              <Search size={17} aria-hidden="true" />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Xizmat nomi yoki kalit so‘z bo‘yicha qidirish...')} aria-label={t('Qidirish')} autoComplete="off" />
            </label>
            <RegionSelect value={region} onChange={setRegion} className="gm-svc__region" />
            <label className="gm-svc__select">
              <span className="gm-visually-hidden">{t('Narx oralig‘i')}</span>
              <select value={presetKey ?? 'custom'} onChange={(event) => { const preset = PRICE_PRESETS.find((item) => item.key === event.target.value); setPrice(preset ? { min: preset.min, max: preset.max } : price); }} aria-label={t('Narx oralig‘i')}>
                {PRICE_PRESETS.map((preset) => <option key={preset.key} value={preset.key}>{preset.key ? preset.label : t('Narx oralig‘i')}</option>)}
                {presetKey === undefined && <option value="custom">{t('Maxsus narx')}</option>}
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </label>
            <label className="gm-svc__select">
              <span className="gm-visually-hidden">{t('Mavjud ustalar')}</span>
              <select value={available ? 'yes' : ''} onChange={(event) => setAvailable(event.target.value === 'yes')} aria-label={t('Mavjud ustalar')}>
                <option value="">{t('Barcha xizmatlar')}</option>
                <option value="yes">{t('Mavjud ustalar')}{facets ? ` (${facets.available})` : ''}</option>
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </label>
            <label className="gm-svc__select">
              <span className="gm-visually-hidden">{t('Saralash')}</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label={t('Saralash')}>
                {SORTS.map((option) => <option key={option.value} value={option.value}>{t('Saralash')}: {option.label}</option>)}
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </label>
            <button type="button" className="gm-svc__filterbtn" onClick={() => setPanelOpen((open) => !open)} aria-expanded={panelOpen}>
              <Filter size={16} aria-hidden="true" /> {t('Filtrlar')}{filterCount > 0 && <span>{filterCount}</span>}
            </button>
          </div>

          {catalog.isLoading && <PageLoader />}
          {catalog.isError && <Alert tone="danger">{getErrorMessage(catalog.error)}</Alert>}
          {data && data.items.length === 0 && (
            <EmptyState icon={<Search size={26} />} title={t('Xizmat topilmadi')} description={filterCount > 0 || debouncedSearch ? t('Filtrlarni o‘zgartirib yoki tozalab ko‘ring.') : t('Hozircha xizmatlar yo‘q')} action={chips.length > 0 ? <button type="button" className="gm-button gm-button--secondary" onClick={reset}>{t('Filtrlarni tozalash')}</button> : undefined} />
          )}

          <div className={cx('gm-svc__list', catalog.isFetching && 'is-loading')}>
            {data?.items.map((service) => (
              <article key={service.id} className="gm-svc__card">
                <div className="gm-svc__art">
                  <ServiceArt categoryId={service.category.id} categoryName={service.category.name} />
                  <span className="gm-svc__tag">{service.category.name}</span>
                  <span className={cx('gm-svc__masters', service.masters === 0 && 'is-none')}><Users size={13} aria-hidden="true" /> {service.masters > 0 ? t('{count} ta usta', { count: service.masters }) : t('Usta yo‘q')}</span>
                </div>
                <div className="gm-svc__body">
                  <h3>{service.name}</h3>
                  <p className="gm-svc__desc">{service.description ?? t('{category} bo‘yicha xizmat', { category: service.category.name })}</p>
                  <div className="gm-svc__meta">
                    <p className="gm-svc__price">{service.minPrice != null ? <><small>{t('dan')}</small> {formatMoney(service.minPrice)}</> : <span>{t('Narx kelishiladi')}</span>}</p>
                    <span className="gm-svc__rating">{service.rating != null ? <><Star size={14} fill="currentColor" aria-hidden="true" /> <b>{service.rating.toFixed(1)}</b> <small>({formatNumber(service.ratingCount)})</small></> : <small>{t('Yangi')}</small>}</span>
                  </div>
                  <div className="gm-svc__actions">
                    <Link to={`/mijoz/sorov-yaratish?xizmat=${service.id}`} className="gm-button gm-button--primary gm-button--md">{t('Buyurtma berish')}</Link>
                    <Link to={`/mijoz/ustalar?kategoriya=${service.category.id}`} className="gm-button gm-button--secondary gm-button--md">{t('Ustalarni ko‘rish')} <ArrowRight size={15} aria-hidden="true" /></Link>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {data && data.total > 0 && (
            <footer className="gm-svc__foot">
              <span>{t('Jami {total} ta xizmat topildi', { total: formatNumber(data.total) })}</span>
              <nav className="gm-svc__pager" aria-label={t('Sahifalar')}>
                <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label={t('Oldingi sahifa')}><ChevronLeft size={16} /></button>
                {pageNumbers(page, data.pages).map((entry) =>
                  typeof entry === 'number' ? (
                    <button key={entry} type="button" className={cx(entry === page && 'is-on')} aria-current={entry === page ? 'page' : undefined} onClick={() => setPage(entry)}>{entry}</button>
                  ) : (
                    <span key={entry}>…</span>
                  ),
                )}
                <button type="button" onClick={() => setPage(page + 1)} disabled={page >= data.pages} aria-label={t('Keyingi sahifa')}><ChevronRight size={16} /></button>
              </nav>
            </footer>
          )}
        </div>

        <aside className={cx('gm-svc__panel', panelOpen && 'is-open')} aria-label={t('Filtrlar')}>
          <header>
            <h2>{t('Tanlangan filtrlar')}</h2>
            <button type="button" onClick={reset} disabled={chips.length === 0}>{t('Tozalash')}</button>
            <button type="button" className="gm-svc__panelclose" onClick={() => setPanelOpen(false)} aria-label={t('Yopish')}><X size={18} /></button>
          </header>
          {chips.length > 0 ? (
            <div className="gm-svc__chips">
              {chips.map((chip) => <span key={chip.key}>{chip.label}<button type="button" onClick={chip.clear} aria-label={t('{name} filtrini olib tashlash', { name: chip.label })}><X size={12} /></button></span>)}
            </div>
          ) : (
            <p className="gm-svc__none">{t('Filtr tanlanmagan')}</p>
          )}

          <section>
            <h3>{t('Kategoriyalar')}</h3>
            <label className="gm-svc__csearch"><Search size={14} aria-hidden="true" /><input value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder={t('Kategoriya qidirish...')} aria-label={t('Kategoriya qidirish')} /></label>
            <label className="gm-svc__check"><input type="checkbox" checked={selected.length === 0} onChange={() => setSelected([])} /><span>{t('Barchasi')}</span><em>{data ? formatNumber(facets?.categories.reduce((sum, item) => sum + item.count, 0) ?? 0) : '…'}</em></label>
            {shownCategories.map((item) => (
              <label key={item.id} className="gm-svc__check"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleCategory(item.id)} /><span>{item.name}</span><em>{item.count}</em></label>
            ))}
            {visibleCategories.length > 6 && !categorySearch && (
              <button type="button" className="gm-svc__more" onClick={() => setAllCategories((value) => !value)}>{allCategories ? t('Kamroq ko‘rsatish') : t('Barchasini ko‘rish')} <ChevronDown size={14} className={cx(allCategories && 'is-up')} /></button>
            )}
          </section>

          <section>
            <h3><MapPin size={14} aria-hidden="true" /> {t('Hudud')}</h3>
            <RegionSelect value={region} onChange={setRegion} className="gm-svc__region gm-svc__region--panel" />
          </section>

          {hasBounds && (
            <section>
              <h3>{t('Narx oralig‘i')}</h3>
              <div className="gm-svc__range">
                <input type="range" min={priceBounds.min} max={priceBounds.max} step={1000} value={sliderMin} onChange={(event) => setPrice({ ...price, min: Math.min(Number(event.target.value), sliderMax) <= priceBounds.min ? undefined : Math.min(Number(event.target.value), sliderMax) })} aria-label={t('Eng kam narx')} />
                <input type="range" min={priceBounds.min} max={priceBounds.max} step={1000} value={sliderMax} onChange={(event) => setPrice({ ...price, max: Math.max(Number(event.target.value), sliderMin) >= priceBounds.max ? undefined : Math.max(Number(event.target.value), sliderMin) })} aria-label={t('Eng ko‘p narx')} />
              </div>
              <div className="gm-svc__priceinputs">
                <input inputMode="numeric" value={formatNumber(sliderMin)} onChange={(event) => { const value = Number(digits(event.target.value)); setPrice({ ...price, min: value <= priceBounds.min ? undefined : Math.min(value, sliderMax) }); }} aria-label={t('Eng kam narx')} />
                <span>—</span>
                <input inputMode="numeric" value={`${formatNumber(sliderMax)}${price.max === undefined ? '+' : ''}`} onChange={(event) => { const value = Number(digits(event.target.value)); setPrice({ ...price, max: value >= priceBounds.max ? undefined : Math.max(value, sliderMin) }); }} aria-label={t('Eng ko‘p narx')} />
              </div>
            </section>
          )}

          <section>
            <h3>{t('Ustalar soni')}</h3>
            {([['1', t('1 ta usta'), facets?.masters.one], ['2-3', t('2-3 ta usta'), facets?.masters.few], ['4+', t('4+ ta usta'), facets?.masters.many]] as const).map(([value, label, count]) => (
              <label key={value} className="gm-svc__check"><input type="checkbox" checked={masters === value} onChange={() => setMasters(masters === value ? '' : value)} /><span>{label}</span><em>{count ?? '…'}</em></label>
            ))}
          </section>

          <section>
            <h3>{t('Reyting')}</h3>
            {RATINGS.map((item) => (
              <label key={item.key} className="gm-svc__check gm-svc__check--radio">
                <input type="radio" name="gm-svc-rating" checked={rating === item.value} onChange={() => setRating(rating === item.value ? undefined : item.value)} onClick={() => rating === item.value && setRating(undefined)} />
                <span className="gm-svc__stars">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={14} fill={index < Math.round(item.value) ? 'currentColor' : 'none'} aria-hidden="true" />)} <b>{item.label}</b></span>
                <em>{facets?.ratings[item.key] ?? '…'}</em>
              </label>
            ))}
          </section>
        </aside>
        {panelOpen && <button type="button" className="gm-svc__backdrop" onClick={() => setPanelOpen(false)} aria-label={t('Yopish')} />}
      </div>
    </div>
  );
}
