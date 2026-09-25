import { AlertCircle, Banknote, CheckCircle2, Clock, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { formatMoney } from '@/lib/utils';
import { useConfirmCash } from '@/features/payment/hooks/usePayment';
import { PAYMENT_STATUS_LABEL, providerLabel } from '@/features/payment/labels';
import '@/features/payment/components/Payment.css';
import type { OrderDetailsData } from '../types';

type Tone = 'success' | 'warning' | 'danger' | 'neutral';
const BADGE: Record<Tone, BadgeTone> = { success: 'success', warning: 'warning', danger: 'danger', neutral: 'neutral' };

/**
 * Buyurtmaning to‘lov holati: usul, summa, holat va bugungi kerakli amal.
 * Mijoz uchun tugma holatga qarab o‘zgaradi; usta naqd pulni shu yerda tasdiqlaydi.
 */
export function OrderPaymentCard({ order }: { order: OrderDetailsData }) {
  const confirmCash = useConfirmCash();
  const { payment } = order;
  const isMaster = order.viewerRole === 'MASTER';
  if (order.status === 'CANCELLED' || order.status === 'EXPIRED') return null;
  const completed = order.status === 'COMPLETED';
  const payLink = `/mijozlar/buyurtmalar/${order.id}/tolov`;

  let tone: Tone = 'neutral';
  let title = 'To‘lov usuli tanlanmagan';
  let hint = 'Mijoz ishni tasdiqlaganda to‘lov usulini tanlaydi.';
  let Icon = CreditCard;
  let customerAction: { label: string; primary: boolean } | null = null;

  if (!payment) {
    if (completed) {
      tone = 'warning';
      hint = isMaster ? 'Mijoz hali to‘lov usulini tanlamagan.' : 'Buyurtma yakunlandi. To‘lov usulini tanlang va to‘lovni rasmiylashtiring.';
      customerAction = { label: 'To‘lov usulini tanlash', primary: true };
    } else if (!isMaster) {
      hint = 'Ish tugagach to‘lov usulini tanlaysiz. Hozirdan ham tanlab qo‘yishingiz mumkin.';
      customerAction = { label: 'To‘lov usulini tanlash', primary: false };
    }
  } else if (payment.status === 'SUCCEEDED' || payment.status === 'PARTIALLY_REFUNDED' || payment.status === 'REFUNDED') {
    tone = 'success';
    title = 'To‘lov qabul qilindi';
    hint = payment.provider === 'CASH' ? 'Usta naqd pulni qabul qilganini tasdiqladi.' : 'To‘lov muvaffaqiyatli yakunlangan.';
    Icon = CheckCircle2;
  } else if (payment.status === 'FAILED' || payment.status === 'CANCELLED') {
    tone = 'danger';
    title = 'To‘lov amalga oshmadi';
    hint = isMaster ? 'Mijozning to‘lovi amalga oshmadi.' : 'To‘lov amalga oshmadi. Qayta urinib ko‘ring yoki boshqa usulni tanlang.';
    Icon = AlertCircle;
    if (!isMaster) customerAction = { label: 'Qayta urinish', primary: true };
  } else if (payment.provider === 'CASH') {
    tone = 'warning';
    title = 'Naqd to‘lov kutilmoqda';
    Icon = Banknote;
    hint = isMaster
      ? completed
        ? 'Mijoz naqd pul bilan to‘laydi. Pulni olgach, pastdagi tugma bilan tasdiqlang.'
        : 'Mijoz ishni tasdiqlagach, naqd pulni olganingizni shu yerdan tasdiqlaysiz.'
      : 'Pulni ustaga qo‘lda topshiring. Usta olganini tasdiqlagach, to‘lov yakunlanadi.';
    if (!isMaster) customerAction = { label: 'Usulni o‘zgartirish', primary: false };
  } else {
    tone = 'warning';
    title = `${providerLabel(payment.provider)} to‘lovi kutilmoqda`;
    Icon = Clock;
    hint = isMaster ? 'Mijoz onlayn to‘lov qilishi kutilmoqda.' : 'To‘lov hali yakunlanmagan. To‘lovni davom ettiring yoki boshqa usulni tanlang.';
    if (!isMaster) customerAction = { label: `${providerLabel(payment.provider)} orqali to‘lash`, primary: true };
  }

  const canConfirmCash = isMaster && payment?.provider === 'CASH' && payment.status === 'PENDING' && completed;

  return (
    <section className={`gm-opaycard gm-opaycard--${tone}`} aria-label="To‘lov">
      <header className="gm-opaycard__head">
        <h2>
          <Icon size={20} aria-hidden="true" /> {title}
        </h2>
        {payment && <Badge tone={BADGE[tone]}>{PAYMENT_STATUS_LABEL[payment.status] ?? payment.status}</Badge>}
      </header>
      <div className="gm-opaycard__body">
        <div className="gm-opaycard__method">
          <span className="gm-paym__icon" aria-hidden="true">
            {payment?.provider === 'CASH' ? <Banknote size={20} /> : <CreditCard size={20} />}
          </span>
          <div>
            <strong>{payment ? providerLabel(payment.provider) : 'Usul tanlanmagan'}</strong>
            <small>To‘lov usuli</small>
          </div>
        </div>
        <span className="gm-opaycard__amount">{formatMoney(payment?.amount ?? order.finalAmount, payment?.currency ?? order.currency)}</span>
      </div>
      <p className="gm-opaycard__hint">{hint}</p>
      {confirmCash.isError && <Alert tone="danger">{getErrorMessage(confirmCash.error)}</Alert>}
      {(customerAction || canConfirmCash) && (
        <div className="gm-opaycard__actions">
          {customerAction && (
            <Link to={payLink}>
              <Button variant={customerAction.primary ? 'primary' : 'secondary'}>
                <CreditCard size={16} /> {customerAction.label}
              </Button>
            </Link>
          )}
          {canConfirmCash && payment && (
            <Button loading={confirmCash.isPending} onClick={() => confirmCash.mutate(payment.id)}>
              <Banknote size={16} /> Naqd pulni qabul qildim
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
