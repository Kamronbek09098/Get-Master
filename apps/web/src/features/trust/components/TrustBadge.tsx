import { Badge } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import type { MasterVerificationStatus } from '@/features/master/types';

const LABEL: Record<MasterVerificationStatus, string> = {
  PENDING: 'Tasdiqlanmagan',
  UNDER_REVIEW: 'Ko‘rib chiqilmoqda',
  CORRECTION_REQUESTED: 'Tuzatish so‘ralgan',
  VERIFIED: 'Tasdiqlangan',
  REJECTED: 'Rad etilgan',
  EXPIRED: 'Muddati tugagan',
  INACTIVE: 'Nofaol',
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
