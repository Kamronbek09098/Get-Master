export type PolicyType =
  | 'TERMS'
  | 'PRIVACY'
  | 'PUBLIC_OFFER'
  | 'PLATFORM_RULES'
  | 'PAYMENT'
  | 'REFUND'
  | 'CANCELLATION'
  | 'WARRANTY';
export type PolicyStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export const POLICY_TYPE_LABEL: Record<PolicyType, string> = {
  TERMS: 'Foydalanish shartlari',
  PRIVACY: 'Maxfiylik siyosati',
  PUBLIC_OFFER: 'Ommaviy oferta',
  PLATFORM_RULES: 'Platforma qoidalari',
  PAYMENT: 'To‘lov shartlari',
  REFUND: 'Qaytarish shartlari',
  CANCELLATION: 'Bekor qilish shartlari',
  WARRANTY: 'Kafolat shartlari',
};

export interface Policy {
  id: string;
  type: PolicyType;
  version: string;
  title: string;
  content?: string;
  status: PolicyStatus;
  publishedAt: string | null;
  createdAt?: string;
}

export interface PolicyAcceptance {
  id: string;
  policyId: string;
  acceptedAt: string;
}

export interface CreatePolicyInput {
  type: PolicyType;
  version: string;
  title: string;
  content: string;
}
