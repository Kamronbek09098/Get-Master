import { Badge } from '@/components/ui/Badge';
import { formatMoney } from '@/lib/utils';
import type { Payment } from '../types';
import type { PaymentStatus as PaymentStatusEnum } from '@/types/common';

const LABEL: Record<PaymentStatusEnum, string> = {
  PENDING: 'Kutilmoqda',
  PROCESSING: 'Amalga oshirilmoqda',
  SUCCEEDED: 'Muvaffaqiyatli',
  FAILED: 'Muvaffaqiyatsiz',
  CANCELLED: 'Bekor qilindi',
  REFUNDED: 'Qaytarildi',
  PARTIALLY_REFUNDED: 'Qisman qaytarildi',
};
const TONE: Record<PaymentStatusEnum, 'neutral' | 'success' | 'danger' | 'warning'> = {
  PENDING: 'neutral',
  PROCESSING: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  CANCELLED: 'danger',
  REFUNDED: 'warning',
  PARTIALLY_REFUNDED: 'warning',
};

export function PaymentStatus({ payment }: { payment: Payment }) {
  return (
    <p>
      {formatMoney(payment.amount, payment.currency)} — <Badge tone={TONE[payment.status]}>{LABEL[payment.status]}</Badge>
    </p>
  );
}
