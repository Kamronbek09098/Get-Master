export type CaseStatus = 'REPORTED' | 'UNDER_REVIEW' | 'CONFIRMED' | 'DISMISSED' | 'RESOLVED';

export interface CaseItem {
  id: string;
  orderId: string | null;
  openedById: string;
  targetUserId: string | null;
  title: string;
  description: string;
  status: CaseStatus;
  decision: string | null;
  createdAt: string;
}

export interface CreateDisputeInput {
  orderId: string;
  title: string;
  description: string;
}

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  REPORTED: 'Yuborildi',
  UNDER_REVIEW: 'Ko‘rib chiqilmoqda',
  CONFIRMED: 'Tasdiqlandi',
  DISMISSED: 'Rad etildi',
  RESOLVED: 'Hal qilindi',
};
