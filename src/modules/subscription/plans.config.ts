import type { SubscriptionAudience } from '@prisma/client';

/** Obuna imkoniyatlari (fichalar). Serverda shu kalitlar bo‘yicha tekshiriladi, mijoz ilovasida tavsif sifatida ko‘rsatiladi. */
export type Feature =  | 'SEE_DELETED_MESSAGES'
  | 'SEE_EDIT_HISTORY'
  | 'PRIORITY_REQUESTS'
  | 'PLUS_BADGE'
  | 'PRO_BADGE'
  | 'CATALOG_BOOST'
  | 'EXTRA_PORTFOLIO';

export type PlanMonths = 1 | 3 | 12;
export const PLAN_MONTHS: PlanMonths[] = [1, 3, 12];

export interface PlanDef {
  code: 'CUSTOMER_PLUS' | 'MASTER_PRO';
  audience: SubscriptionAudience;
  name: string;
  tagline: string;
  /** Muddat (oy) → narx (so‘m). */
  prices: Record<PlanMonths, number>;
  features: Feature[];
}

export const PLANS: PlanDef[] = [
  {
    code: 'CUSTOMER_PLUS',
    audience: 'CUSTOMER',
    name: 'Plus',
    tagline: 'Muloqot va buyurtmalar ustidan to‘liq nazorat',
    prices: { 1: 5_000, 3: 13_500, 12: 43_000 },
    features: ['SEE_DELETED_MESSAGES', 'SEE_EDIT_HISTORY', 'PRIORITY_REQUESTS', 'PLUS_BADGE'],
  },
  {
    code: 'MASTER_PRO',
    audience: 'MASTER',
    name: 'Pro',
    tagline: 'Ko‘proq mijoz, ko‘proq ishonch',
    prices: { 1: 10_000, 3: 27_000, 12: 84_000 },
    features: ['PRO_BADGE', 'CATALOG_BOOST', 'EXTRA_PORTFOLIO'],
  },
];

export const planByCode = (code: string): PlanDef | undefined => PLANS.find((plan) => plan.code === code);

/** Pro usta portfolio limiti: oddiy ustadagidan necha baravar ko‘p. */
export const PRO_PORTFOLIO_MULTIPLIER = 2;

/** Obuna uchun to‘lov usullari (naqd to‘lov yo‘q). */
export const PAYMENT_METHODS = ['CLICK', 'PAYME', 'UZUM', 'CARD'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
