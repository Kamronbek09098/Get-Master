import { t } from '@/i18n';
export type UserActionType = 'WARNING' | 'FINE' | 'RESTRICTION' | 'SUSPENSION' | 'BAN';
export type RestrictionType = 'REQUESTS' | 'OFFERS' | 'BOOKING' | 'CHAT' | 'PAYMENTS' | 'FULL_ACCOUNT';
export type AppealStatus = 'OPEN' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'CLOSED';
export type CompensationType = 'REFUND' | 'PARTIAL_REFUND' | 'CREDIT' | 'OTHER';

export const ACTION_LABEL: Record<UserActionType, string> = {
  WARNING: t('Ogohlantirish'),
  FINE: t('Jarima'),
  RESTRICTION: t('Cheklov'),
  SUSPENSION: t('To‘xtatib qo‘yish'),
  BAN: t('Bloklash'),
};

export const RESTRICTION_LABEL: Record<RestrictionType, string> = {
  REQUESTS: t('So‘rovlar'),
  OFFERS: t('Takliflar'),
  BOOKING: t('Bronlar'),
  CHAT: t('Chat'),
  PAYMENTS: t('To‘lovlar'),
  FULL_ACCOUNT: t('Butun akkaunt'),
};

export const APPEAL_LABEL: Record<AppealStatus, string> = {
  OPEN: t('Ochiq'),
  UNDER_REVIEW: t('Ko‘rib chiqilmoqda'),
  ACCEPTED: t('Qabul qilindi'),
  REJECTED: t('Rad etildi'),
  CLOSED: t('Yopildi'),
};

export const COMPENSATION_LABEL: Record<CompensationType, string> = {
  REFUND: t('To‘liq qaytarish'),
  PARTIAL_REFUND: t('Qisman qaytarish'),
  CREDIT: t('Kredit'),
  OTHER: t('Boshqa'),
};

export interface UserAction {
  id: string;
  userId: string;
  caseId: string | null;
  type: UserActionType;
  restrictionType: RestrictionType | null;
  reason: string;
  startsAt: string;
  expiresAt: string | null;
  liftedAt: string | null;
  createdAt: string;
}

export interface Appeal {
  id: string;
  userId: string;
  caseId: string | null;
  actionId: string | null;
  status: AppealStatus;
  reason: string;
  decision: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface Compensation {
  id: string;
  caseId: string | null;
  recipientId: string;
  type: CompensationType;
  amount: string | null;
  currency: string;
  reason: string;
  createdAt: string;
}

export interface CreateUserActionInput {
  userId: string;
  type: UserActionType;
  restrictionType?: RestrictionType;
  reason: string;
  expiresAt?: string;
  caseId?: string;
}

export interface CreateCompensationInput {
  recipientId: string;
  type: CompensationType;
  amount?: number;
  reason: string;
  caseId?: string;
}
