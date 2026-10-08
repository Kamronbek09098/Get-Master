import { Link } from 'react-router-dom';
import { AlertCircle, ChevronRight, Clock, Hash, Users } from 'lucide-react';
import { accountName } from '@/lib/account-name';
import { categoryIcon } from '@/features/service/category-icon';
import { RequestStatus } from '@/features/request/components/RequestStatus';
import type { ProblemRequestSummary } from '@/features/request/types';
import { formatDateTime, formatMoney, formatRelativeTime } from '@/lib/utils';
import { FLOW_STEPS, stepIndex } from '../order-flow';
import { OrderStatus } from './OrderStatus';
import type { OrderListItem } from '../types';
import './MyOrders.css';
import { t } from '@/i18n';

export type MyOrderItem = { kind: 'request'; request: ProblemRequestSummary } | { kind: 'order'; order: OrderListItem };

/** Mijoz uchun yagona karta: usta hali tanlanmagan bo‘lsa — so‘rov bosqichi, tanlangan bo‘lsa — buyurtma. */
export function MyOrderCard({ item }: { item: MyOrderItem }) {
  if (item.kind === 'request') {
    const { request } = item;
    const offers = request.offersCount ?? 0;
    const Icon = categoryIcon(request.service?.name ?? request.title);
    const draft = request.status === 'DRAFT';
    const waiting = request.status === 'SUBMITTED' || request.status === 'MATCHING';
    return (
      <Link to={`/mijoz/sorovlar/${request.id}`} className={`gm-mo ${offers > 0 || draft ? 'gm-mo--action' : ''}`}>
        <span className="gm-mo__icon" aria-hidden="true">
          <Icon size={22} strokeWidth={1.9} />
        </span>
        <div className="gm-mo__body">
          <div className="gm-mo__head">
            <h3>{request.title}</h3>
            <RequestStatus status={request.status} />
          </div>
          <p className="gm-mo__sub">{request.service?.name ?? t('Xizmat turi tanlanmagan')}</p>
          <p className="gm-mo__text">{request.description}</p>
          {offers > 0 && (
            <p className="gm-mo__alert">
              <Users size={14} aria-hidden="true" />{' '}{t('{offers} ta taklif keldi. Ko‘rib chiqib, ustani tanlang', { offers })}</p>
          )}
          {draft && (
            <p className="gm-mo__alert">
              <AlertCircle size={14} aria-hidden="true" />{' '}{t('So‘rov hali yuborilmagan. Yuborish uchun oching.')}</p>
          )}
          {waiting && offers === 0 && (
            <p className="gm-mo__hint">
              <Clock size={14} aria-hidden="true" />{' '}{t('Mos ustalar qidirilmoqda, takliflar shu yerda ko‘rinadi.')}</p>
          )}
          <div className="gm-mo__foot">
            <span className="gm-mo__stage">{t('So‘rov bosqichi')}</span>
            <span className="gm-mo__time" title={formatDateTime(request.createdAt)}>
              {formatRelativeTime(request.createdAt)}
            </span>
          </div>
        </div>
        <ChevronRight size={20} className="gm-mo__go" aria-hidden="true" />
      </Link>
    );
  }

  const { order } = item;
  const Icon = categoryIcon(order.service?.name ?? order.title);
  const index = stepIndex(order.status);
  const percent = order.status === 'COMPLETED' ? 100 : index >= 0 ? Math.round(((index + 1) / FLOW_STEPS.length) * 100) : 0;
  const needsConfirm = order.status === 'WAITING_CONFIRMATION';
  return (
    <Link to={`/mijoz/buyurtmalar/${order.id}`} className={`gm-mo ${needsConfirm ? 'gm-mo--action' : ''}`}>
      <span className="gm-mo__icon" aria-hidden="true">
        <Icon size={22} strokeWidth={1.9} />
      </span>
      <div className="gm-mo__body">
        <div className="gm-mo__head">
          <h3>{order.title}</h3>
          <OrderStatus status={order.status} />
        </div>
        <p className="gm-mo__sub">
          {order.service?.name ?? t('Xizmat')}{' '}{t('· Usta:')}{' '}<strong>{accountName(order.counterpart)}</strong>
        </p>
        {needsConfirm && (
          <p className="gm-mo__alert">
            <AlertCircle size={14} aria-hidden="true" />{' '}{t('Usta ishni tugatdi. Natijani ko‘rib, tasdiqlang.')}</p>
        )}
        {index >= 0 && order.status !== 'COMPLETED' && (
          <div className="gm-mo__bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={t('Bajarilish darajasi')}>
            <span style={{ width: `${percent}%` }} />
          </div>
        )}
        <div className="gm-mo__foot">
          <span className="gm-mo__stage gm-mo__stage--order">
            <Hash size={12} aria-hidden="true" />{t('Buyurtma №{orderNumber}', { orderNumber: order.orderNumber })}</span>
          <span className="gm-mo__amount">{formatMoney(order.finalAmount, order.currency)}</span>
          <span className="gm-mo__time">{formatDateTime(order.createdAt)}</span>
        </div>
      </div>
      <ChevronRight size={20} className="gm-mo__go" aria-hidden="true" />
    </Link>
  );
}
