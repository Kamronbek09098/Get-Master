import type { PaymentProvider, PaymentStatus } from '@/types/common';

export const PROVIDER_LABEL: Record<PaymentProvider, string> = {
  CASH: 'Naqd pul',
  CLICK: 'Click',
  PAYME: 'Payme',
  UZUM: 'Uzum',
  OTHER: 'Boshqa usul',
};

export const PROVIDER_OPTIONS: Array<{ value: PaymentProvider; label: string; hint: string }> = [
  { value: 'CASH', label: 'Naqd pul', hint: 'Ish tugagach ustaga qo‘lda to‘laysiz; usta olganini tasdiqlaydi' },
  { value: 'CLICK', label: 'Click', hint: 'Onlayn to‘lov' },
  { value: 'PAYME', label: 'Payme', hint: 'Onlayn to‘lov' },
  { value: 'UZUM', label: 'Uzum', hint: 'Onlayn to‘lov' },
];

export const providerLabel = (provider: string) => PROVIDER_LABEL[provider as PaymentProvider] ?? provider;

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: 'Kutilmoqda',
  PROCESSING: 'Jarayonda',
  SUCCEEDED: 'To‘langan',
  FAILED: 'Muvaffaqiyatsiz',
  CANCELLED: 'Bekor qilingan',
  REFUNDED: 'Qaytarilgan',
  PARTIALLY_REFUNDED: 'Qisman qaytarilgan',
};
