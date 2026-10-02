import { formatDateTime, formatMoney } from '@/lib/utils';
import type { Order } from '../types';
import { t } from '@/i18n';

export function OrderDetails({ order }: { order: Order }) {
  return (
    <dl className="gm-key-value">
      <dt>{t('Summa')}</dt>
      <dd>{formatMoney(order.finalAmount, order.currency)}</dd>

      {Number(order.additionalAmount) > 0 && (
        <>
          <dt>{t('Qo‘shimcha ish summasi')}</dt>
          <dd>{formatMoney(order.additionalAmount, order.currency)}</dd>
        </>
      )}

      <dt>{t('Yaratildi')}</dt>
      <dd>{formatDateTime(order.createdAt)}</dd>

      {order.confirmedAt && (
        <>
          <dt>{t('Tasdiqlandi')}</dt>
          <dd>{formatDateTime(order.confirmedAt)}</dd>
        </>
      )}
      {order.startedAt && (
        <>
          <dt>{t('Ish boshlandi')}</dt>
          <dd>{formatDateTime(order.startedAt)}</dd>
        </>
      )}
      {order.completionSubmittedAt && (
        <>
          <dt>{t('Yakunlanishi taqdim etildi')}</dt>
          <dd>{formatDateTime(order.completionSubmittedAt)}</dd>
        </>
      )}
      {order.completedAt && (
        <>
          <dt>{t('Yakunlandi')}</dt>
          <dd>{formatDateTime(order.completedAt)}</dd>
        </>
      )}
      {order.cancelledAt && (
        <>
          <dt>{t('Bekor qilindi')}</dt>
          <dd>
            {formatDateTime(order.cancelledAt)}
            {order.cancellationReason ? ` — ${order.cancellationReason}` : ''}
          </dd>
        </>
      )}
    </dl>
  );
}
