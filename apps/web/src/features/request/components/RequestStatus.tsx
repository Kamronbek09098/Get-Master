import { Badge } from '@/components/ui/Badge';
import type { RequestStatus as RequestStatusEnum } from '@/types/common';
import { t } from '@/i18n';

const LABEL: Record<RequestStatusEnum, string> = {
  DRAFT: t('Qoralama'),
  SUBMITTED: t('Yuborildi'),
  MATCHING: t('Mos usta izlanmoqda'),
  OFFERS_RECEIVED: t('Takliflar keldi'),
  BOOKED: t('Band qilindi'),
  CANCELLED: t('Bekor qilindi'),
  EXPIRED: t('Muddati tugadi'),
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
