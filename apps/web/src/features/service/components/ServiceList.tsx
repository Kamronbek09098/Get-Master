import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { useMyServices, useRemoveMyService } from '../hooks/useServices';
import { ServiceCard } from './ServiceCard';

export function ServiceList() {
  const services = useMyServices();
  const removeService = useRemoveMyService();
  const items = services.data ?? [];

  if (services.isLoading) return <PageLoader label="Xizmatlar yuklanmoqda…" />;
  if (services.isError) return <Alert tone="danger">{getErrorMessage(services.error)}</Alert>;
  if (items.length === 0) return <EmptyState title="Hali xizmat qo‘shilmagan" />;

  return (
    <div className="gm-list">
      {removeService.isError && <Alert tone="danger">{getErrorMessage(removeService.error)}</Alert>}
      {items.map((item) => (
        <ServiceCard key={item.id} item={item} onRemove={() => removeService.mutate(item.serviceId)} />
      ))}
    </div>
  );
}
