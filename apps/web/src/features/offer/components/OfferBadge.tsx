import { Badge } from '@/components/ui/Badge';
import type { OfferStatus } from '@/types/common';
import { t } from '@/i18n';

const LABEL: Record<OfferStatus, string> = {
  PENDING: t('Kutilmoqda'),
  ACCEPTED: t('Qabul qilingan'),
  REJECTED: t('Rad etilgan'),
  EXPIRED: t('Muddati tugagan'),
  WITHDRAWN: t('Qaytarib olingan'),
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
