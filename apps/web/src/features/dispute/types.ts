import { t } from '@/i18n';
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
  REPORTED: t('Yuborildi'),
  UNDER_REVIEW: t('Ko‘rib chiqilmoqda'),
  CONFIRMED: t('Tasdiqlandi'),
  DISMISSED: t('Rad etildi'),
  RESOLVED: t('Hal qilindi'),
};

export type CaseTone = 'ok' | 'no' | 'wait';
/** Holatning rang toni: yakunlangan (ok/no) yoki kutilmoqda. */
export const caseTone = (status: string): CaseTone => (status === 'RESOLVED' || status === 'CONFIRMED' ? 'ok' : status === 'DISMISSED' ? 'no' : 'wait');

export const CASE_TYPE_LABEL: Record<string, string> = {
  DISPUTE: t('Nizo'),
  COMPLAINT: t('Shikoyat'),
};

/** Tizim avtomatik yozgan inglizcha sarlavhani («Dispute on order <uuid>») o‘qiladigan, tilga mos ko‘rinishga keltiradi. */
export function caseTitle(title: string, orderId?: string | null): string {
  const match = /^Dispute on order\s+([0-9a-f-]{36})/i.exec(title.trim());
  if (!match) return title;
  return `${t('Buyurtma bo‘yicha nizo')} № ${(orderId ?? match[1]!).slice(0, 8).toUpperCase()}`;
}

/** Sarlavhada ID bo‘lsa, qisqa tartib raqami (birinchi 8 belgi). */
export const shortId = (id: string) => id.slice(0, 8).toUpperCase();
