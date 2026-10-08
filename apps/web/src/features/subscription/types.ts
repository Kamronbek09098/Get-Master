export type SubscriptionAudience = 'CUSTOMER' | 'MASTER';
export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'REJECTED';
export type PlanCode = 'CUSTOMER_PLUS' | 'MASTER_PRO';
export type Feature = 'SEE_DELETED_MESSAGES' | 'SEE_EDIT_HISTORY' | 'PRIORITY_REQUESTS' | 'PLUS_BADGE' | 'PRO_BADGE' | 'CATALOG_BOOST' | 'EXTRA_PORTFOLIO';
export type PayMethod = 'CLICK' | 'PAYME' | 'UZUM' | 'CARD' | 'CASH';

export interface PlanPrice {
  months: 1 | 3 | 12;
  price: number;
  savingPercent: number;
}

export interface Plan {
  code: PlanCode;
  audience: SubscriptionAudience;
  name: string;
  tagline: string;
  features: Feature[];
  prices: PlanPrice[];
}

export interface PlansResponse {
  plans: Plan[];
  methods: string[];
  currency: string;
}

export interface SubscriptionRow {
  id: string;
  audience: SubscriptionAudience;
  planCode: PlanCode;
  months: number;
  amount: string;
  currency: string;
  status: SubscriptionStatus;
  source: 'PURCHASE' | 'GRANT';
  method: PayMethod | null;
  reference: string;
  note: string | null;
  startsAt: string | null;
  endsAt: string | null;
  rejectReason: string | null;
  createdAt: string;
}

export interface PaymentInstructions {
  card: string;
  holder: string;
  note: string;
}

export interface MySubscriptions {
  customer: (SubscriptionRow & { endsAtTotal: string }) | null;
  master: (SubscriptionRow & { endsAtTotal: string }) | null;
  pending: SubscriptionRow[];
  history: SubscriptionRow[];
  instructions: PaymentInstructions;
}

export interface AdminSubscriptionRow extends SubscriptionRow {
  user: { id: string; accountNumber: number; name: string; phone: string | null };
}

export interface AdminSubscriptionList {
  items: AdminSubscriptionRow[];
  total: number;
  page: number;
  limit: number;
  counts: Partial<Record<SubscriptionStatus, number>>;
}
