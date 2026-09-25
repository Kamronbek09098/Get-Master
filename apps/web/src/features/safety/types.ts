export type UserActionType = 'WARNING' | 'FINE' | 'RESTRICTION' | 'SUSPENSION' | 'BAN';
export type RestrictionType = 'REQUESTS' | 'OFFERS' | 'BOOKING' | 'CHAT' | 'PAYMENTS' | 'FULL_ACCOUNT';
export type AppealStatus = 'OPEN' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'CLOSED';
export type CompensationType = 'REFUND' | 'PARTIAL_REFUND' | 'CREDIT' | 'OTHER';

export const ACTION_LABEL: Record<UserActionType, string> = {
  WARNING: 'Ogohlantirish',
  FINE: 'Jarima',
  RESTRICTION: 'Cheklov',
  SUSPENSION: 'To‘xtatib qo‘yish',
  BAN: 'Bloklash',
};

export const RESTRICTION_LABEL: Record<RestrictionType, string> = {
  REQUESTS: 'So‘rovlar',
  OFFERS: 'Takliflar',
  BOOKING: 'Bronlar',
  CHAT: 'Chat',
  PAYMENTS: 'To‘lovlar',
  FULL_ACCOUNT: 'Butun akkaunt',
};

export const APPEAL_LABEL: Record<AppealStatus, string> = {
  OPEN: 'Ochiq',
  UNDER_REVIEW: 'Ko‘rib chiqilmoqda',
  ACCEPTED: 'Qabul qilindi',
  REJECTED: 'Rad etildi',
  CLOSED: 'Yopildi',
};

export const COMPENSATION_LABEL: Record<CompensationType, string> = {
  REFUND: 'To‘liq qaytarish',
  PARTIAL_REFUND: 'Qisman qaytarish',
  CREDIT: 'Kredit',
  OTHER: 'Boshqa',
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
