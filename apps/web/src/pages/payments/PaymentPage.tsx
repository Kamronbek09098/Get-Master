import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { formatMoney } from '@/lib/utils';
import { accountName } from '@/lib/account-name';
import { OrderStatus } from '@/features/order/components/OrderStatus';
import { useOrder } from '@/features/order/hooks/useOrders';
import { PaymentForm } from '@/features/payment/components/PaymentForm';
import '@/features/payment/components/Payment.css';

export function PaymentPage() {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const order = useOrder(orderId);
  const back = `/mijozlar/buyurtmalar/${orderId}`;

  if (order.isLoading) return <PageLoader label="Buyurtma yuklanmoqda…" />;
  if (order.isError) return <Alert tone="danger">{getErrorMessage(order.error)}</Alert>;
  const data = order.data;
  if (!data) return null;
  const extra = Number(data.additionalAmount) > 0;

  return (
    <div className="gm-pay">
      <Link to={back} className="gm-pay__back">
        <ArrowLeft size={16} /> Buyurtmaga qaytish
      </Link>
      <header className="gm-pay__head">
        <h1>To‘lov</h1>
        <p>{data.request?.title ?? 'Buyurtma'} · #{data.id.slice(0, 8)}</p>
      </header>

      <div className="gm-pay__layout">
        <PaymentForm order={data} />

        <aside className="gm-pay__panel gm-pay__aside" aria-label="Buyurtma xulosasi">
          <h2>Buyurtma xulosasi</h2>
          <div className="gm-pay__order">
            <strong>{data.request?.title ?? 'Buyurtma'}</strong>
            <small>
              {data.service?.name ?? 'Xizmat'} · Usta: {accountName(data.counterpart)}
            </small>
            <span>
              <OrderStatus status={data.status} />
            </span>
          </div>
          <dl className="gm-pay__sum">
            <div>
              <dt>Kelishilgan narx</dt>
              <dd>{formatMoney(data.originalAmount, data.currency)}</dd>
            </div>
            {extra && (
              <div>
                <dt>Qo‘shimcha ishlar</dt>
                <dd>{formatMoney(data.additionalAmount, data.currency)}</dd>
              </div>
            )}
            <div className="gm-pay__total">
              <dt>To‘lanadigan summa</dt>
              <dd>{formatMoney(data.finalAmount, data.currency)}</dd>
            </div>
          </dl>
          <p className="gm-pay__note">
            <ShieldCheck size={16} aria-hidden="true" /> Summa buyurtma yakunlanganda aniqlanadi va qo‘shimcha to‘lovsiz o‘zgarmaydi.
          </p>
        </aside>
      </div>
    </div>
  );
}
