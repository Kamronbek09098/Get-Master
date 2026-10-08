export type SubscriptionAudience = 'CUSTOMER' | 'MASTER';
export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'REJECTED';
export type PlanCode = 'CUSTOMER_PLUS' | 'MASTER_PRO';
export type Feature = 'SEE_DELETED_MESSAGES' | 'SEE_EDIT_HISTORY' | 'PRIORITY_REQUESTS' | 'PLUS_BADGE' | 'PRO_BADGE' | 'CATALOG_BOOST' | 'EXTRA_PORTFOLIO';
export type PayMethod = 'CLICK' | 'PAYME' | 'UZUM' | 'CARD';
export const GATEWAY_METHODS: PayMethod[] = ['CLICK', 'PAYME', 'UZUM'];

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
  /** Barcha usullar; `available: false` — to‘lov tizimi hali ulanmagan (tanlab bo‘lmaydi). */
  allMethods?: Array<{ method: PayMethod; available: boolean }>;
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
  paidAt?: string | null;
  hasReceipt?: boolean;
  /** Click / Payme / Uzum to‘lov sahifasi (to‘lanmagan so‘rov uchun). */
  checkoutUrl?: string | null;
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

export interface AdminSummary {
  activeCustomers: number;
  activeMasters: number;
  pendingReceipts: number;
  pendingNoReceipt: number;
  revenue30d: number;
  revenueTotal: number;
  byMethod30d: Array<{ method: string; count: number; amount: number }>;
  byPlan: Array<{ planCode: string; count: number; amount: number }>;
}

export interface AdminSubscriptionRow extends SubscriptionRow {
  receiptAssetId?: string | null;
  providerTxId?: string | null;
  user: { id: string; accountNumber: number; name: string; phone: string | null };
}

export interface AdminSubscriptionList {
  items: AdminSubscriptionRow[];
  total: number;
  page: number;
  limit: number;
  counts: Partial<Record<SubscriptionStatus, number>>;
}

export interface SubscriptionUserHit {
  id: string;
  accountNumber: number;
  name: string;
  phone: string | null;
  createdAt: string;
  isMaster: boolean;
  plus: string | null;
  pro: string | null;
}

export interface SubscriptionUserPage {
  items: SubscriptionUserHit[];
  page: number;
  hasMore: boolean;
}
