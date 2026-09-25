import { Badge } from '@/components/ui/Badge';
import type { OrderStatus as OrderStatusEnum } from '@/types/common';

const LABEL: Record<OrderStatusEnum, string> = {
  DRAFT: 'Qoralama',
  SUBMITTED: 'Yuborildi',
  MATCHING: 'Mos usta izlanmoqda',
  OFFERS_RECEIVED: 'Takliflar keldi',
  BOOKED: 'Band qilindi',
  CONFIRMED: 'Tasdiqlandi',
  ON_THE_WAY: 'Usta yo‘lda',
  ARRIVED: 'Usta yetib keldi',
  IN_PROGRESS: 'Ish jarayonida',
  WAITING_CONFIRMATION: 'Tasdiq kutilmoqda',
  COMPLETED: 'Yakunlandi',
  CANCELLED: 'Bekor qilindi',
  EXPIRED: 'Muddati tugadi',
  DISPUTED: 'Nizoli',
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
