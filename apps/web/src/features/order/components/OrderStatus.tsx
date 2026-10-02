import { Badge } from '@/components/ui/Badge';
import type { OrderStatus as OrderStatusEnum } from '@/types/common';
import { t } from '@/i18n';

const LABEL: Record<OrderStatusEnum, string> = {
  DRAFT: t('Qoralama'),
  SUBMITTED: t('Yuborildi'),
  MATCHING: t('Mos usta izlanmoqda'),
  OFFERS_RECEIVED: t('Takliflar keldi'),
  BOOKED: t('Band qilindi'),
  CONFIRMED: t('Tasdiqlandi'),
  ON_THE_WAY: t('Usta yo‘lda'),
  ARRIVED: t('Usta yetib keldi'),
  IN_PROGRESS: t('Ish jarayonida'),
  WAITING_CONFIRMATION: t('Tasdiq kutilmoqda'),
  COMPLETED: t('Yakunlandi'),
  CANCELLED: t('Bekor qilindi'),
  EXPIRED: t('Muddati tugadi'),
  DISPUTED: t('Nizoli'),
};

const TONE: Record<OrderStatusEnum, 'neutral' | 'primary' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'primary',
  MATCHING: 'primary',
  OFFERS_RECEIVED: 'primary',
  BOOKED: 'primary',
  CONFIRMED: 'primary',
  ON_THE_WAY: 'warning',
  ARRIVED: 'warning',
  IN_PROGRESS: 'warning',
  WAITING_CONFIRMATION: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  EXPIRED: 'danger',
  DISPUTED: 'danger',
};

export function OrderStatus({ status }: { status: OrderStatusEnum }) {
  return <Badge tone={TONE[status]}>{LABEL[status]}</Badge>;
}
