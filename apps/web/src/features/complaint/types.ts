import type { CaseItem } from '@/features/dispute/types';

export type Complaint = CaseItem;

export interface CreateComplaintInput {
  orderId?: string;
  title: string;
  description: string;
}
