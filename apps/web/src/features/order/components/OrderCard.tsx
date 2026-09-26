import { Link } from 'react-router-dom';
import { accountName } from '@/lib/account-name';
import { formatDateTime, formatMoney } from '@/lib/utils';
import { FLOW_STEPS, stepIndex } from '../order-flow';
import { OrderStatus } from './OrderStatus';
import type { OrderListItem } from '../types';
import './Order.css';

export function OrderCard({ order }: { order: OrderListItem }) {
  const basePath = order.viewerRole === 'MASTER' ? '/ustalar/buyurtmalar' : '/mijozlar/buyurtmalar';
  const index = stepIndex(order.status);
  const percent = order.status === 'COMPLETED' ? 100 : index >= 0 ? Math.round(((index + 1) / FLOW_STEPS.length) * 100) : 0;
  const party = order.viewerRole === 'MASTER' ? 'Mijoz' : 'Usta';

  return (
    <Link to={`${basePath}/${order.id}`} className="gm-ocardlink">
      <div className="gm-ocardlink__top">
        <div>
          <h3 className="gm-ocardlink__title">{order.title}</h3>
          <p className="gm-ocardlink__meta">{order.service?.name ?? 'Xizmat'}</p>
        </div>
        <OrderStatus status={order.status} />
      </div>
      <p className="gm-ocardlink__meta">Buyurtma №{order.orderNumber}</p>
      <p className="gm-ocardlink__meta">
        {party}: <strong>{accountName(order.counterpart)}</strong>
      </p>
      {index >= 0 && (
        <div className="gm-ocardlink__bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Bajarilish darajasi">
          <span style={{ width: `${percent}%` }} />
        </div>
      )}
      <div className="gm-ocardlink__foot">
        <span className="gm-ocardlink__amount">{formatMoney(order.finalAmount, order.currency)}</span>
        <span className="gm-ocardlink__meta">{formatDateTime(order.createdAt)}</span>
      </div>
    </Link>
  );
}
