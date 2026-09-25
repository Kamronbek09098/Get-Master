import { formatDateTime, formatMoney } from '@/lib/utils';
import type { Order } from '../types';

export function OrderDetails({ order }: { order: Order }) {
  return (
    <dl className="gm-key-value">
      <dt>Summa</dt>
      <dd>{formatMoney(order.finalAmount, order.currency)}</dd>

      {Number(order.additionalAmount) > 0 && (
        <>
          <dt>Qo‘shimcha ish summasi</dt>
          <dd>{formatMoney(order.additionalAmount, order.currency)}</dd>
        </>
      )}

      <dt>Yaratildi</dt>
      <dd>{formatDateTime(order.createdAt)}</dd>

      {order.confirmedAt && (
        <>
          <dt>Tasdiqlandi</dt>
          <dd>{formatDateTime(order.confirmedAt)}</dd>
        </>
      )}
      {order.startedAt && (
        <>
          <dt>Ish boshlandi</dt>
          <dd>{formatDateTime(order.startedAt)}</dd>
        </>
      )}
      {order.completionSubmittedAt && (
        <>
          <dt>Yakunlanishi taqdim etildi</dt>
          <dd>{formatDateTime(order.completionSubmittedAt)}</dd>
        </>
      )}
      {order.completedAt && (
        <>
          <dt>Yakunlandi</dt>
          <dd>{formatDateTime(order.completedAt)}</dd>
        </>
      )}
      {order.cancelledAt && (
        <>
          <dt>Bekor qilindi</dt>
          <dd>
            {formatDateTime(order.cancelledAt)}
            {order.cancellationReason ? ` — ${order.cancellationReason}` : ''}
          </dd>
        </>
      )}
    </dl>
  );
}
