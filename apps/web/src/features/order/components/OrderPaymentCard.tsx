import { AlertCircle, Banknote, CheckCircle2, Clock, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { formatMoney, newIdempotencyKey } from '@/lib/utils';
import { useConfirmCash, useCreatePayment } from '@/features/payment/hooks/usePayment';
import { PaymentMethodCards } from '@/features/payment/components/PaymentMethodCards';
import { ProviderLogo } from '@/features/payment/components/ProviderLogo';
import { PAYMENT_STATUS_LABEL, PROVIDER_LABEL, providerLabel } from '@/features/payment/labels';
import type { PaymentProvider } from '@/types/common';
import '@/features/payment/components/Payment.css';
import type { OrderDetailsData } from '../types';
import { t } from '@/i18n';

type Tone = 'success' | 'warning' | 'danger' | 'neutral';
const BADGE: Record<Tone, BadgeTone> = { success: 'success', warning: 'warning', danger: 'danger', neutral: 'neutral' };

/**
 * Buyurtmaning to‘lov holati: usul, summa, holat va bugungi kerakli amal.
 * Mijoz uchun tugma holatga qarab o‘zgaradi; usta naqd pulni shu yerda tasdiqlaydi.
 */
export function OrderPaymentCard({
  order,
  selectedMethod = '',
  onSelectMethod,
}: {
  order: OrderDetailsData;
  /** Mijoz kartada tanlagan usul (buyurtma sahifasi bilan umumiy: «Ishni tasdiqlash» ham shuni ishlatadi). */
  selectedMethod?: PaymentProvider | '';
  onSelectMethod?: (method: PaymentProvider) => void;
}) {
  const queryClient = useQueryClient();
  const confirmCash = useConfirmCash();
  const createPayment = useCreatePayment();
  const [testNote, setTestNote] = useState(false);
  const { payment } = order;
  const isMaster = order.viewerRole === 'MASTER';
  if (order.status === 'CANCELLED' || order.status === 'EXPIRED') return null;
  const completed = order.status === 'COMPLETED';

  let tone: Tone = 'neutral';
  let title = t('To‘lov usuli tanlanmagan');
  let hint = t('Mijoz ishni tasdiqlaganda to‘lov usulini tanlaydi.');
  let Icon = CreditCard;

  if (!payment) {
    if (completed) {
      tone = 'warning';
      hint = isMaster ? t('Mijoz hali to‘lov usulini tanlamagan.') : t('Buyurtma yakunlandi. To‘lov usulini tanlang va to‘lovni rasmiylashtiring.');
    } else if (order.status === 'WAITING_CONFIRMATION') {
      tone = 'warning';
      hint = isMaster ? t('Mijoz to‘lovni amalga oshirishi kutilmoqda.') : t('Ishni tasdiqlash uchun to‘lovni hozir to‘liq amalga oshiring.');
    } else if (!isMaster) {
      hint = t('Ish tugagach to‘lovni amalga oshirib, ishni tasdiqlaysiz. Usulni hozirdan tanlab qo‘yishingiz mumkin.');
    }
  } else if (payment.status === 'SUCCEEDED' || payment.status === 'PARTIALLY_REFUNDED' || payment.status === 'REFUNDED') {
    tone = 'success';
    title = t('To‘lov qabul qilindi');
    hint = payment.provider === 'CASH' ? t('Usta naqd pulni qabul qilganini tasdiqladi.') : t('To‘lov muvaffaqiyatli yakunlangan.');
    Icon = CheckCircle2;
  } else if (payment.status === 'FAILED' || payment.status === 'CANCELLED') {
    tone = 'danger';
    title = t('To‘lov amalga oshmadi');
    hint = isMaster ? t('Mijozning to‘lovi amalga oshmadi.') : t('To‘lov amalga oshmadi. Qayta urinib ko‘ring yoki boshqa usulni tanlang.');
    Icon = AlertCircle;
  } else if (payment.provider === 'CASH') {
    tone = 'warning';
    title = t('Naqd to‘lov kutilmoqda');
    Icon = Banknote;
    hint = isMaster
      ? completed || order.status === 'WAITING_CONFIRMATION'
        ? t('Mijoz naqd pul bilan to‘laydi. Pulni olgach, pastdagi tugma bilan tasdiqlang — shundan keyin mijoz ishni tasdiqlay oladi.')
        : t('Ish tugagach, mijoz naqd pulni topshiradi va siz olganingizni shu yerdan tasdiqlaysiz.')
      : t('Pulni ustaga qo‘lda topshiring. Usta olganini tasdiqlagach, to‘lov yakunlanadi.');
  } else {
    tone = 'warning';
    title = t('{providerLabel} to‘lovi kutilmoqda', { providerLabel: providerLabel(payment.provider) });
    Icon = Clock;
    hint = isMaster ? t('Mijoz onlayn to‘lov qilishi kutilmoqda.') : t('To‘lov hali yakunlanmagan. To‘lovni davom ettiring yoki boshqa usulni tanlang.');
  }

  const canConfirmCash = isMaster && payment?.provider === 'CASH' && payment.status === 'PENDING' && (completed || order.status === 'WAITING_CONFIRMATION');

  // Mijoz to‘lov usulini shu kartaning o‘zida tanlaydi va to‘lovni shu yerda rasmiylashtiradi (alohida sahifasiz).
  const settled = !!payment && ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status);
  const pendingProvider: PaymentProvider | null = payment?.status === 'PENDING' ? payment.provider : null;
  const canChoose = !isMaster && !settled;
  const selected: PaymentProvider | '' = selectedMethod || pendingProvider || '';
  const changed = !!selected && selected !== pendingProvider;
  const resumeOnline = !!pendingProvider && pendingProvider !== 'CASH' && selected === pendingProvider;
  const showPay = canChoose && !!selected && (changed || resumeOnline);
  const amountText = formatMoney(order.finalAmount, order.currency);
  const payLabel = selected === 'CASH' ? t('Naqd to‘lovni tanlash') : selected ? t('{item} orqali {amountText} to‘lash', { item: PROVIDER_LABEL[selected], amountText }) : '';
  function startPayment() {
    if (!selected) return;
    createPayment.mutate(
      { orderId: order.id, provider: selected, idempotencyKey: newIdempotencyKey() },
      {
        onSuccess: (result) => {
          void queryClient.invalidateQueries({ queryKey: ['orders'] });
          const url = result.checkoutUrl;
          if (!url) return;
          if (url.startsWith('https://payment.example/')) setTestNote(true);
          else window.location.href = url;
        },
      },
    );
  }

  return (
    <section id="tolov" className={`gm-opaycard gm-opaycard--${tone}`} aria-label={t('To‘lov')}>
      <header className="gm-opaycard__head">
        <h2>
          <Icon size={20} aria-hidden="true" /> {title}
        </h2>
        {payment && <Badge tone={BADGE[tone]}>{PAYMENT_STATUS_LABEL[payment.status] ?? payment.status}</Badge>}
      </header>
      <div className="gm-opaycard__body">
        <div className="gm-opaycard__method">
          {payment ? (
            <ProviderLogo provider={payment.provider} size={44} />
          ) : (
            <span className="gm-paym__icon gm-paym__icon--empty" aria-hidden="true">
              <CreditCard size={22} />
            </span>
          )}
          <div>
            <strong>{payment ? providerLabel(payment.provider) : t('Usul tanlanmagan')}</strong>
            <small>{t('To‘lov usuli')}</small>
          </div>
        </div>
        <span className="gm-opaycard__amount">{formatMoney(payment?.amount ?? order.finalAmount, payment?.currency ?? order.currency)}</span>
      </div>
      <p className="gm-opaycard__hint">{hint}</p>
      {canChoose && (
        <div className="gm-opaycard__choose">
          <h3 className="gm-opaycard__choose-title">{pendingProvider ? t('To‘lov usuli') : t('To‘lov usulini tanlang')}</h3>
          <PaymentMethodCards value={selected} onChange={(method) => onSelectMethod?.(method)} current={pendingProvider} compact disabled={createPayment.isPending} />
        </div>
      )}
      {confirmCash.isError && <Alert tone="danger">{getErrorMessage(confirmCash.error)}</Alert>}
      {createPayment.isError && <Alert tone="danger">{getErrorMessage(createPayment.error)}</Alert>}
      {testNote && (
        <Alert tone="warning" title={t('Sinov rejimi')}>{t('Haqiqiy to‘lov provayderi hali ulanmagan, shuning uchun real to‘lov sahifasiga o‘tilmaydi.')}</Alert>
      )}
      {(showPay || canConfirmCash) && (
        <div className="gm-opaycard__actions">
          {showPay && (
            <Button loading={createPayment.isPending} onClick={startPayment}>
              {selected === 'CASH' ? <Banknote size={16} /> : <CreditCard size={16} />} {payLabel}
            </Button>
          )}
          {canConfirmCash && payment && (
            <Button loading={confirmCash.isPending} onClick={() => confirmCash.mutate(payment.id)}>
              <Banknote size={16} />{' '}{t('Naqd pulni qabul qildim')}</Button>
          )}
        </div>
      )}
    </section>
  );
}
