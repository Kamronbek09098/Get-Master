import { Clock3, Trash2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatMoney } from '@/lib/utils';
import type { MasterServiceItem } from '../types';
import './service.css';

export function ServiceCard({ item, onRemove, removing }: { item: MasterServiceItem; onRemove?: () => void; removing?: boolean }) {
  return (
    <div className="gm-svc-card">
      <span className="gm-svc-card__icon" aria-hidden="true">
        <Wrench size={20} />
      </span>
      <div className="gm-svc-card__body">
        <h3>{item.service.name}</h3>
        {item.description && <p className="gm-svc-card__desc">{item.description}</p>}
        <div className="gm-svc-card__chips">
          <span className={item.basePrice ? 'gm-svc-chip gm-svc-chip--price' : 'gm-svc-chip'}>{item.basePrice ? formatMoney(item.basePrice) : 'Narx kelishiladi'}</span>
          {item.estimatedMinutes && (
            <span className="gm-svc-chip">
              <Clock3 size={13} aria-hidden="true" /> {item.estimatedMinutes} daqiqa
            </span>
          )}
        </div>
      </div>
      {onRemove && (
        <Button size="sm" variant="secondary" className="gm-btn-tone gm-btn-tone--danger gm-svc-card__delete" loading={removing} onClick={onRemove}>
          <Trash2 size={15} /> O‘chirish
        </Button>
      )}
    </div>
  );
}
