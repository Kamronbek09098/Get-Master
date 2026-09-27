import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Banknote, CheckCircle2, Clock, Lock, ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { formatMoney, newIdempotencyKey } from '@/lib/utils';
import type { OrderDetailsData } from '@/features/order/types';
import type { PaymentProvider } from '@/types/common';
import { useCreatePayment } from '../hooks/usePayment';
import { PAYMENT_STATUS_LABEL, PROVIDER_LABEL, providerLabel } from '../labels';
import { PaymentMethodCards } from './PaymentMethodCards';
import './Payment.css';

const SETTLED = ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'];

function Facts({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="gm-pay__facts">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** To‘lov usulini tanlash va to‘lovni rasmiylashtirish. */
export function PaymentForm({ order }: { order: OrderDetailsData }) {
  const queryClient = useQueryClient();
  const createPayment = useCreatePayment();
  const current = order.payment;
  const [method, setMethod] = useState<PaymentProvider>(current && current.status === 'PENDING' ? current.provider : 'CASH');
  const back = `/mijozlar/buyurtmalar/${order.id}`;
  const amount = formatMoney(order.finalAmount, order.currency);

  if (order.status === 'CANCELLED' || order.status === 'EXPIRED') {
    return <Alert tone="warning">Bu buyurtma bekor qilingan, shuning uchun to‘lov qilinmaydi.</Alert>;
  }

  const result = createPayment.data?.payment ?? (current && SETTLED.includes(current.status) ? { ...current, succeededAt: null } : null);
  const checkoutUrl = createPayment.data?.checkoutUrl ?? null;
  const isTestCheckout = !!checkoutUrl && checkoutUrl.startsWith('https://payment.example/');
  const isRealCheckout = !!checkoutUrl && !isTestCheckout;

  useEffect(() => {
    if (isRealCheckout && checkoutUrl) window.location.href = checkoutUrl;
  }, [isRealCheckout, checkoutUrl]);

  if (result && SETTLED.includes(result.status)) {
    return (
      <section className="gm-pay__result">
        <span className="gm-pay__result-icon">
          <CheckCircle2 size={28} />
        </span>
        <h2>To‘lov qabul qilindi</h2>
        <p>Buyurtma bo‘yicha to‘lov muvaffaqiyatli yakunlangan. Rahmat!</p>
        <Facts items={[['Usul', providerLabel(result.provider)], ['Summa', formatMoney(result.amount, result.currency)], ['Holat', PAYMENT_STATUS_LABEL[result.status]]]} />
        <div className="gm-pay__actions">
          <Link to={back}>
            <Button>Buyurtmaga qaytish</Button>
          </Link>
          <Link to="/mijozlar/tolovlar">
            <Button variant="secondary">To‘lovlar tarixi</Button>
          </Link>
        </div>
      </section>
    );
  }

  if (createPayment.data) {
    const payment = createPayment.data.payment;
    const cash = payment.provider === 'CASH';
    return (
      <section className="gm-pay__result gm-pay__result--wait">
        <span className="gm-pay__result-icon">{cash ? <Banknote size={26} /> : <Clock size={26} />}</span>
        <h2>{cash ? 'Naqd to‘lov tanlandi' : `${PROVIDER_LABEL[payment.provider]} to‘lovi yaratildi`}</h2>
        <p>
          {cash
            ? 'Ish tugagach pulni ustaga qo‘lda topshirasiz. Usta pulni olganini tasdiqlagach, to‘lov «To‘langan» holatiga o‘tadi.'
            : 'To‘lov kutilmoqda. To‘lov provayderi tasdiqlagach, holat avtomatik yangilanadi.'}
        </p>
        <Facts items={[['Usul', PROVIDER_LABEL[payment.provider]], ['Summa', formatMoney(payment.amount, payment.currency)], ['Holat', cash ? 'Usta tasdiqlashi kutilmoqda' : PAYMENT_STATUS_LABEL[payment.status]]]} />
        {isTestCheckout && (
          <Alert tone="warning" title="Sinov rejimi">
            Haqiqiy to‘lov provayderi hali ulanmagan, shuning uchun bu real to‘lov sahifasiga olib bormaydi.
          </Alert>
        )}
        {isRealCheckout && (
          <Alert tone="info" title="To‘lov sahifasiga yo‘naltirilmoqda">
            Bir necha soniyada {PROVIDER_LABEL[payment.provider]} to‘lov sahifasiga o‘tasiz.
          </Alert>
        )}
        <div className="gm-pay__actions">
          <Link to={back}>
            <Button>Buyurtmaga qaytish</Button>
          </Link>
        </div>
      </section>
    );
  }

  const cash = method === 'CASH';
  return (
    <section className="gm-pay__panel">
      <h2>To‘lov usulini tanlang</h2>
      <p>{current && current.status === 'PENDING' ? `Hozir «${providerLabel(current.provider)}» tanlangan. Xohlasangiz, boshqa usulga almashtiring.` : 'Qulay usulni tanlang: naqd pul yoki onlayn to‘lov.'}</p>
      {createPayment.isError && <Alert tone="danger">{getErrorMessage(createPayment.error)}</Alert>}
      <PaymentMethodCards value={method} onChange={setMethod} current={current?.status === 'PENDING' ? current.provider : null} disabled={createPayment.isPending} />
      <div className="gm-pay__cta">
        <Button
          size="lg"
          loading={createPayment.isPending}
          onClick={() =>
            createPayment.mutate(
              { orderId: order.id, provider: method, idempotencyKey: newIdempotencyKey() },
              { onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['orders'] }) },
            )
          }
        >
          {cash ? <Banknote size={18} /> : <Lock size={18} />} {cash ? 'Naqd to‘lovni tanlash' : `${PROVIDER_LABEL[method]} orqali ${amount} to‘lash`}
        </Button>
        <p className="gm-pay__note">
          <ShieldCheck size={16} aria-hidden="true" />
          {cash ? 'Naqd to‘lovda pul ustaga qo‘lda topshiriladi. Usta olganini tasdiqlamaguncha to‘lov «Kutilmoqda» holatida turadi.' : 'To‘lov ma’lumotlaringiz himoyalangan. Karta ma’lumotlari bizda saqlanmaydi.'}
        </p>
      </div>
    </section>
  );
}
