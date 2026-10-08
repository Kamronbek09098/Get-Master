import { useId, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cx } from '@/lib/utils';
import { categoryIcon, serviceIcon } from '../category-icon';
import { useServiceCategories } from '../hooks/useServices';
import './ServiceChooser.css';
import { t } from '@/i18n';

const INITIAL_VISIBLE = 8;

export interface ServiceChooserProps {
  label: string;
  value: string;
  onChange: (serviceId: string) => void;
  required?: boolean;
  error?: string;
  hint?: string;
}

/** Xizmat turini tanlash: qidiruv, kategoriya chiplari va ikonali xizmat kartalari. */
export function ServiceChooser({ label, value, onChange, required, error, hint }: ServiceChooserProps) {
  const groupName = useId();
  const categories = useServiceCategories();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expanded, setExpanded] = useState(false);

  const groups = useMemo(
    () => (categories.data ?? []).filter((category) => (category.services ?? []).length > 0),
    [categories.data],
  );

  const services = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return groups
      .filter((category) => activeCategory === 'all' || category.id === activeCategory)
      .flatMap((category) => category.services.map((service) => ({ ...service, category })))
      .filter((service) => !needle || service.name.toLowerCase().includes(needle) || service.category.name.toLowerCase().includes(needle));
  }, [groups, activeCategory, query]);

  // «Hammasi» tanlanganda (qidiruvsiz) xizmatlar kategoriya sarlavhasi ostida guruhlanadi.
  const grouped = activeCategory === 'all' && !query.trim() && groups.length > 1;
  const collapsible = !grouped && !expanded && !query.trim() && services.length > INITIAL_VISIBLE;
  const visible = collapsible ? services.slice(0, INITIAL_VISIBLE) : services;
  const sections = useMemo(() => {
    if (!grouped) return [{ id: 'flat', name: '', items: visible }];
    return groups
      .map((category) => ({ id: category.id, name: category.name, items: visible.filter((service) => service.category.id === category.id) }))
      .filter((section) => section.items.length > 0);
  }, [grouped, groups, visible]);

  const selected = useMemo(
    () => groups.flatMap((category) => category.services.map((service) => ({ ...service, category }))).find((service) => service.id === value),
    [groups, value],
  );

  return (
    <fieldset className={cx('gm-chooser', error && 'gm-chooser--error')}>
      <legend className="gm-field__label">
        {label}
      </legend>

      <div className="gm-chooser__search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          aria-label={t('Xizmat qidirish')}
          placeholder={t('Xizmatni qidiring: masalan, kran, rozetka')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
      </div>

      {groups.length > 1 && (
        <div className="gm-chooser__chips" role="group" aria-label={t('Kategoriyalar')}>
          <button
            type="button"
            className={cx('gm-chooser__chip', activeCategory === 'all' && 'gm-chooser__chip--active')}
            aria-pressed={activeCategory === 'all'}
            onClick={() => setActiveCategory('all')}
          >{t('Hammasi')}</button>
          {groups.map((category) => {
            const Icon = categoryIcon(category.name);
            const active = activeCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                className={cx('gm-chooser__chip', active && 'gm-chooser__chip--active')}
                aria-pressed={active}
                onClick={() => setActiveCategory(category.id)}
              >
                <Icon size={15} aria-hidden="true" /> {category.name}
              </button>
            );
          })}
        </div>
      )}

      {categories.isLoading ? (
        <div className="gm-chooser__grid" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="gm-chooser__skeleton" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <EmptyState title={t('Hech narsa topilmadi')} description={t('Qidiruvni o‘zgartiring yoki boshqa kategoriyani tanlang.')} />
      ) : (
        <div className="gm-chooser__groups" role="radiogroup" aria-label={label} aria-required={required}>
          {sections.map((section) => (
            <section key={section.id} className="gm-chooser__group">
              {grouped && (
                <h3 className="gm-chooser__group-title">
                  {section.name} <small>{section.items.length}</small>
                </h3>
              )}
              <div className="gm-chooser__grid">
                {section.items.map((service) => {
                  const Icon = serviceIcon(service.name, service.category.name);
                  const checked = service.id === value;
                  return (
                    <label key={service.id} className={cx('gm-service-option', checked && 'gm-service-option--checked')}>
                      <input
                        type="radio"
                        name={groupName}
                        value={service.id}
                        checked={checked}
                        onChange={() => onChange(service.id)}
                        className="gm-visually-hidden"
                      />
                      <span className="gm-service-option__icon" aria-hidden="true">
                        <Icon size={20} strokeWidth={1.9} />
                      </span>
                      <span className="gm-service-option__text">
                        <strong>{service.name}</strong>
                        {!grouped && <small>{service.category.name}</small>}
                      </span>
                      <span className="gm-service-option__check" aria-hidden="true">
                        <Check size={14} strokeWidth={3} />
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {collapsible && (
        <button type="button" className="gm-chooser__more" onClick={() => setExpanded(true)}>{t('Yana {p} ta xizmatni ko‘rsatish', { p: services.length - INITIAL_VISIBLE })}</button>
      )}

      {selected && (
        <p className="gm-chooser__selected" role="status">
          <Check size={16} aria-hidden="true" />{' '}{t('Tanlandi:')}{' '}<strong>{selected.name}</strong>
        </p>
      )}
      {hint && !error && <p className="gm-field__hint">{hint}</p>}
      {error && (
        <p className="gm-field__error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
