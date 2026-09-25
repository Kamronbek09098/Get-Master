import type { OrderStatus } from '@/types/common';

export interface FlowStep {
  status: OrderStatus;
  label: string;
}

export const FLOW_STEPS: FlowStep[] = [
  { status: 'BOOKED', label: 'Band qilindi' },
  { status: 'CONFIRMED', label: 'Tasdiqlandi' },
  { status: 'ON_THE_WAY', label: 'Yo‘lda' },
  { status: 'ARRIVED', label: 'Yetib keldi' },
  { status: 'IN_PROGRESS', label: 'Ish jarayonida' },
  { status: 'WAITING_CONFIRMATION', label: 'Tasdiq kutilmoqda' },
  { status: 'COMPLETED', label: 'Yakunlandi' },
];

export const STATUS_TEXT: Record<OrderStatus, string> = {
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

export const ACTOR_TEXT = { CUSTOMER: 'Mijoz', MASTER: 'Usta', ADMIN: 'Administrator', SYSTEM: 'Tizim' } as const;

export const ACTIVE_STATUSES: readonly OrderStatus[] = ['BOOKED', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'WAITING_CONFIRMATION', 'DISPUTED'];

export function stepIndex(status: OrderStatus): number {
  return FLOW_STEPS.findIndex((step) => step.status === status);
}
