import { useState } from 'react';
import type { FormEvent } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/error-messages';
import { useAdminCatalog, useCatalogMutations } from '@/features/admin/hooks/useAdmin';
import type { ServiceCategory } from '@/features/service/types';
import '@/features/master/components/MasterCatalog.css';
import { t } from '@/i18n';

function CategoryCard({ category }: { category: ServiceCategory }) {
  const { removeCategory, createService, removeService, updateCategory } = useCatalogMutations();
  const modes = category.modes && category.modes.length > 0 ? category.modes : ['AT_CUSTOMER'];
  const toggleMode = (mode: 'AT_CUSTOMER' | 'AT_MASTER') => {
    const next = modes.includes(mode) ? modes.filter((item) => item !== mode) : [...modes, mode];
    if (next.length > 0) updateCategory.mutate({ id: category.id, input: { modes: next } });
  };
  const [name, setName] = useState('');
  const error = removeCategory.error ?? createService.error ?? removeService.error ?? updateCategory.error;

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    createService.mutate({ categoryId: category.id, name: name.trim() }, { onSuccess: () => setName('') });
  }

  return (
    <div className="gm-card">
      <div className="gm-card__header">
        <h3>{category.name}</h3>
        <Button size="sm" variant="ghost" className="gm-btn-danger-text" loading={removeCategory.isPending} onClick={() => removeCategory.mutate(category.id)}>{t('Kategoriyani o‘chirish')}</Button>
      </div>
      {error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
      <div className="gm-masters-chips" role="group" aria-label={t('Xizmat rejimlari')}>
        <button type="button" className="gm-masters-chip" aria-pressed={modes.includes('AT_CUSTOMER')} disabled={updateCategory.isPending} onClick={() => toggleMode('AT_CUSTOMER')}>{t('Uyga boradi')}</button>
        <button type="button" className="gm-masters-chip" aria-pressed={modes.includes('AT_MASTER')} disabled={updateCategory.isPending} onClick={() => toggleMode('AT_MASTER')}>{t('O‘z joyida qabul qiladi')}</button>
      </div>
      <ul className="gm-service-list">
        {(category.services ?? []).map((service) => (
          <li key={service.id} className="gm-service-row">
            <span>{service.name}</span>
            <Button size="sm" variant="ghost" className="gm-btn-danger-text" onClick={() => removeService.mutate(service.id)}>{t('O‘chirish')}</Button>
          </li>
        ))}
      </ul>
      <form className="gm-inline-form" onSubmit={handleAdd}>
        <Input label={t('Yangi xizmat')} value={name} maxLength={180} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" size="sm" loading={createService.isPending} disabled={!name.trim()}>{t('Qo‘shish')}</Button>
      </form>
    </div>
  );
}

export function AdminCatalogPage() {
  const catalog = useAdminCatalog();
  const { createCategory } = useCatalogMutations();
  const [name, setName] = useState('');

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    createCategory.mutate({ name: name.trim() }, { onSuccess: () => setName('') });
  }

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>{t('Xizmatlar katalogi')}</h1>
          <p className="gm-page-lead">{t('Kategoriya va xizmatlarni boshqaring.')}</p>
        </div>
      </div>
      <form className="gm-inline-form" onSubmit={handleCreate}>
        <Input label={t('Yangi kategoriya')} value={name} maxLength={150} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" loading={createCategory.isPending} disabled={!name.trim()}>{t('Kategoriya qo‘shish')}</Button>
      </form>
      {createCategory.isError && <Alert tone="danger">{getErrorMessage(createCategory.error)}</Alert>}
      <section className="gm-detail-section">
        {catalog.isLoading && <PageLoader />}
        {catalog.isError && <Alert tone="danger">{getErrorMessage(catalog.error)}</Alert>}
        {catalog.data && catalog.data.length === 0 && <EmptyState title={t('Kategoriyalar yo‘q')} />}
        <div className="gm-list">
          {(catalog.data ?? []).map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </section>
    </div>
  );
}
