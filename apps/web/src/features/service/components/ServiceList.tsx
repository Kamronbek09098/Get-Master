import { useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { useMyServices, useRemoveMyService } from '../hooks/useServices';
import type { MasterServiceItem } from '../types';
import { ServiceCard } from './ServiceCard';

export function ServiceList() {
  const services = useMyServices();
  const removeService = useRemoveMyService();
  const [toRemove, setToRemove] = useState<MasterServiceItem | null>(null);
  const items = services.data ?? [];

  if (services.isLoading) return <PageLoader label="Xizmatlar yuklanmoqda…" />;
  if (services.isError) return <Alert tone="danger">{getErrorMessage(services.error)}</Alert>;
  if (items.length === 0) return <EmptyState title="Hali xizmat qo‘shilmagan" />;

  return (
    <div className="gm-list">
      {removeService.isError && !toRemove && <Alert tone="danger">{getErrorMessage(removeService.error)}</Alert>}
      {items.map((item) => (
        <ServiceCard key={item.id} item={item} onRemove={() => setToRemove(item)} />
      ))}
      <ConfirmDialog
        open={!!toRemove}
        title="Xizmatni o‘chirish"
        description={`“${toRemove?.service.name ?? ''}” xizmati ro‘yxatingizdan olib tashlanadi va shu bo‘yicha so‘rovlar kelmaydi.`}
        confirmLabel="O‘chirish"
        cancelLabel="Bekor qilish"
        tone="danger"
        loading={removeService.isPending}
        onCancel={() => setToRemove(null)}
        onConfirm={() => toRemove && removeService.mutate(toRemove.serviceId, { onSuccess: () => setToRemove(null) })}
      >
        {removeService.isError && <Alert tone="danger">{getErrorMessage(removeService.error)}</Alert>}
      </ConfirmDialog>
    </div>
  );
}
