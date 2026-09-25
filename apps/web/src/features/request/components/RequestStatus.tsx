import { Badge } from '@/components/ui/Badge';
import type { RequestStatus as RequestStatusEnum } from '@/types/common';

const LABEL: Record<RequestStatusEnum, string> = {
  DRAFT: 'Qoralama',
  SUBMITTED: 'Yuborildi',
  MATCHING: 'Mos usta izlanmoqda',
  OFFERS_RECEIVED: 'Takliflar keldi',
  BOOKED: 'Band qilindi',
  CANCELLED: 'Bekor qilindi',
  EXPIRED: 'Muddati tugadi',
};

const TONE: Record<RequestStatusEnum, 'neutral' | 'primary' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'primary',
  MATCHING: 'primary',
  OFFERS_RECEIVED: 'warning',
  BOOKED: 'success',
  CANCELLED: 'danger',
  EXPIRED: 'danger',
};

export function RequestStatus({ status }: { status: RequestStatusEnum }) {
  return <Badge tone={TONE[status]}>{LABEL[status]}</Badge>;
}
