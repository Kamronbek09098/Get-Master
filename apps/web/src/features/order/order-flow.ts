import type { OrderStatus } from '@/types/common';
import { t } from '@/i18n';

export interface FlowStep {
  status: OrderStatus;
  label: string;
}

export const FLOW_STEPS: FlowStep[] = [
  { status: 'BOOKED', label: t('Band qilindi') },
  { status: 'CONFIRMED', label: t('Tasdiqlandi') },
  { status: 'ON_THE_WAY', label: t('Yo‘lda') },
  { status: 'ARRIVED', label: t('Yetib keldi') },
  { status: 'IN_PROGRESS', label: t('Ish jarayonida') },
  { status: 'WAITING_CONFIRMATION', label: t('Tasdiq kutilmoqda') },
  { status: 'COMPLETED', label: t('Yakunlandi') },
];

export const STATUS_TEXT: Record<OrderStatus, string> = {
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

export const ACTOR_TEXT = { CUSTOMER: t('Mijoz'), MASTER: t('Usta'), ADMIN: t('Administrator'), SYSTEM: t('Tizim') } as const;

export const ACTIVE_STATUSES: readonly OrderStatus[] = ['BOOKED', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'WAITING_CONFIRMATION', 'DISPUTED'];

export function stepIndex(status: OrderStatus): number {
  return FLOW_STEPS.findIndex((step) => step.status === status);
}
