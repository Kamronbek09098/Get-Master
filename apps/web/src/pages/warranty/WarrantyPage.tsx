import { PageLoader } from '@/components/common/PageLoader';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { useAuthStore } from '@/store/auth.store';
import { useMyWarranties } from '@/features/warranty/hooks/useWarranties';
import { WarrantyCard } from '@/features/warranty/components/WarrantyCard';

export function WarrantyPage() {
  const warranties = useMyWarranties();
  const role = useAuthStore((state) => state.preferredRole);
  const items = warranties.data ?? [];

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>Kafolatlar</h1>
          <p className="gm-page-lead">Bajarilgan ishlar bo‘yicha kafolat murojaatlari.</p>
        </div>
      </div>
      {warranties.isLoading && <PageLoader label="Kafolatlar yuklanmoqda…" />}
      {warranties.isError && <Alert tone="danger">{getErrorMessage(warranties.error)}</Alert>}
      {!warranties.isLoading && items.length === 0 && <EmptyState title="Kafolatlar yo‘q" />}
      <div className="gm-list">
        {items.map((warranty) => (
          <WarrantyCard key={warranty.id} warranty={warranty} canClaim={role !== 'MASTER'} />
        ))}
      </div>
    </div>
  );
}
