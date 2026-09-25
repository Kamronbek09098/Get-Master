import { Badge } from '@/components/ui/Badge';
import type { OfferStatus } from '@/types/common';

const LABEL: Record<OfferStatus, string> = {
  PENDING: 'Kutilmoqda',
  ACCEPTED: 'Qabul qilingan',
  REJECTED: 'Rad etilgan',
  EXPIRED: 'Muddati tugagan',
  WITHDRAWN: 'Qaytarib olingan',
};
const TONE: Record<OfferStatus, 'neutral' | 'success' | 'danger' | 'warning'> = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'neutral',
  WITHDRAWN: 'neutral',
};

export function OfferBadge({ status }: { status: OfferStatus }) {
  return <Badge tone={TONE[status]}>{LABEL[status]}</Badge>;
}
