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
import { t } from '@/i18n';

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

  const result = createPayment.data?.payment ?? (current && SETTLED.includes(current.status) ? { ...current, succeededAt: null } : null);
  const checkoutUrl = createPayment.data?.checkoutUrl ?? null;
  const isTestCheckout = !!checkoutUrl && checkoutUrl.startsWith('https://payment.example/');
  const isRealCheckout = !!checkoutUrl && !isTestCheckout;

  useEffect(() => {
    if (isRealCheckout && checkoutUrl) window.location.href = checkoutUrl;
  }, [isRealCheckout, checkoutUrl]);

  if (order.status === 'CANCELLED' || order.status === 'EXPIRED') {
    return <Alert tone="warning">{t('Bu buyurtma bekor qilingan, shuning uchun to‘lov qilinmaydi.')}</Alert>;
  }

  if (result && SETTLED.includes(result.status)) {
    return (
      <section className="gm-pay__result">
        <span className="gm-pay__result-icon">
          <CheckCircle2 size={28} />
        </span>
        <h2>{t('To‘lov qabul qilindi')}</h2>
        <p>{t('Buyurtma bo‘yicha to‘lov muvaffaqiyatli yakunlangan. Rahmat!')}</p>
        <Facts items={[['Usul', providerLabel(result.provider)], ['Summa', formatMoney(result.amount, result.currency)], ['Holat', PAYMENT_STATUS_LABEL[result.status]]]} />
        <div className="gm-pay__actions">
          <Link to={back}>
            <Button>{t('Buyurtmaga qaytish')}</Button>
          </Link>
          <Link to="/mijozlar/tolovlar">
            <Button variant="secondary">{t('To‘lovlar tarixi')}</Button>
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
        <h2>{cash ? t('Naqd to‘lov tanlandi') : t('{item} to‘lovi yaratildi', { item: PROVIDER_LABEL[payment.provider] })}</h2>
        <p>
          {cash
            ? t('Ish tugagach pulni ustaga qo‘lda topshirasiz. Usta pulni olganini tasdiqlagach, to‘lov «To‘langan» holatiga o‘tadi.')
            : t('To‘lov kutilmoqda. To‘lov provayderi tasdiqlagach, holat avtomatik yangilanadi.')}
        </p>
        <Facts items={[[t('Usul'), PROVIDER_LABEL[payment.provider]], [t('Summa'), formatMoney(payment.amount, payment.currency)], [t('Holat'), cash ? t('Usta tasdiqlashi kutilmoqda') : PAYMENT_STATUS_LABEL[payment.status]]]} />
        {isTestCheckout && (
          <Alert tone="warning" title={t('Sinov rejimi')}>{t('Haqiqiy to‘lov provayderi hali ulanmagan, shuning uchun bu real to‘lov sahifasiga olib bormaydi.')}</Alert>
        )}
        {isRealCheckout && (
          <Alert tone="info" title={t('To‘lov sahifasiga yo‘naltirilmoqda')}>{t('Bir necha soniyada {item} to‘lov sahifasiga o‘tasiz.', { item: PROVIDER_LABEL[payment.provider] })}</Alert>
        )}
        <div className="gm-pay__actions">
          <Link to={back}>
            <Button>{t('Buyurtmaga qaytish')}</Button>
          </Link>
        </div>
      </section>
    );
  }

  const cash = method === 'CASH';
  return (
    <section className="gm-pay__panel">
      <h2>{t('To‘lov usulini tanlang')}</h2>
      <p>{current && current.status === 'PENDING' ? t('Hozir «{providerLabel}» tanlangan. Xohlasangiz, boshqa usulga almashtiring.', { providerLabel: providerLabel(current.provider) }) : t('Qulay usulni tanlang: naqd pul yoki onlayn to‘lov.')}</p>
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
          {cash ? <Banknote size={18} /> : <Lock size={18} />} {cash ? t('Naqd to‘lovni tanlash') : t('{item} orqali {amount} to‘lash', { item: PROVIDER_LABEL[method], amount })}
        </Button>
        <p className="gm-pay__note">
          <ShieldCheck size={16} aria-hidden="true" />
          {cash ? t('Naqd to‘lovda pul ustaga qo‘lda topshiriladi. Usta olganini tasdiqlamaguncha to‘lov «Kutilmoqda» holatida turadi.') : t('To‘lov ma’lumotlaringiz himoyalangan. Karta ma’lumotlari bizda saqlanmaydi.')}
        </p>
      </div>
    </section>
  );
}
