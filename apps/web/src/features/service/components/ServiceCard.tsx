import { Button } from '@/components/ui/Button';
import { formatMoney } from '@/lib/utils';
import type { MasterServiceItem } from '../types';

export function ServiceCard({ item, onRemove }: { item: MasterServiceItem; onRemove?: () => void }) {
  return (
    <div className="gm-card">
      <div className="gm-card__header">
        <h3>{item.service.name}</h3>
        {onRemove && (
          <Button size="sm" variant="danger" onClick={onRemove}>
            O‘chirish
          </Button>
        )}
      </div>
      {item.description && <p>{item.description}</p>}
      <p className="gm-card__meta">Narx: {item.basePrice ? formatMoney(item.basePrice) : 'Kelishiladi'}</p>
      {item.estimatedMinutes && <p className="gm-card__meta">Taxminiy vaqt: {item.estimatedMinutes} daqiqa</p>}
    </div>
  );
}
