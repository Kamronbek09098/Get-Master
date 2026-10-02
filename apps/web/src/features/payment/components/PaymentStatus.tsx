import { Badge } from '@/components/ui/Badge';
import { formatMoney } from '@/lib/utils';
import type { Payment } from '../types';
import type { PaymentStatus as PaymentStatusEnum } from '@/types/common';
import { t } from '@/i18n';

const LABEL: Record<PaymentStatusEnum, string> = {
  PENDING: t('Kutilmoqda'),
  PROCESSING: t('Amalga oshirilmoqda'),
  SUCCEEDED: t('Muvaffaqiyatli'),
  FAILED: t('Muvaffaqiyatsiz'),
  CANCELLED: t('Bekor qilindi'),
  REFUNDED: t('Qaytarildi'),
  PARTIALLY_REFUNDED: t('Qisman qaytarildi'),
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
