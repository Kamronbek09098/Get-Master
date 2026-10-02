import { Badge } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import type { MasterVerificationStatus } from '@/features/master/types';
import { t } from '@/i18n';

const LABEL: Record<MasterVerificationStatus, string> = {
  PENDING: t('Tasdiqlanmagan'),
  UNDER_REVIEW: t('Ko‘rib chiqilmoqda'),
  CORRECTION_REQUESTED: t('Tuzatish so‘ralgan'),
  VERIFIED: t('Tasdiqlangan'),
  REJECTED: t('Rad etilgan'),
  EXPIRED: t('Muddati tugagan'),
  INACTIVE: t('Nofaol'),
};

const TONE: Record<MasterVerificationStatus, BadgeTone> = {
  PENDING: 'neutral',
  UNDER_REVIEW: 'primary',
  CORRECTION_REQUESTED: 'warning',
  VERIFIED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'danger',
  INACTIVE: 'neutral',
};

export function TrustBadge({ verification }: { verification: MasterVerificationStatus }) {
  return <Badge tone={TONE[verification]}>{LABEL[verification]}</Badge>;
}
