import type { PaymentProvider, PaymentStatus } from '@/types/common';
import { t } from '@/i18n';

export const PROVIDER_LABEL: Record<PaymentProvider, string> = {
  CASH: t('Naqd pul'),
  CLICK: t('Click'),
  PAYME: t('Payme'),
  UZUM: t('Uzum'),
  OTHER: t('Boshqa usul'),
};

export const PROVIDER_OPTIONS: Array<{ value: PaymentProvider; label: string; hint: string }> = [
  { value: 'CASH', label: t('Naqd pul'), hint: t('Ish tugagach ustaga qo‘lda to‘laysiz; usta olganini tasdiqlaydi.') },
  { value: 'CLICK', label: t('Click'), hint: t('Onlayn to‘lov') },
  { value: 'PAYME', label: t('Payme'), hint: t('Onlayn to‘lov') },
  { value: 'UZUM', label: t('Uzum'), hint: t('Onlayn to‘lov') },
];

export const providerLabel = (provider: string) => PROVIDER_LABEL[provider as PaymentProvider] ?? provider;

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: t('Kutilmoqda'),
  PROCESSING: t('Jarayonda'),
  SUCCEEDED: t('To‘langan'),
  FAILED: t('Muvaffaqiyatsiz'),
  CANCELLED: t('Bekor qilingan'),
  REFUNDED: t('Qaytarilgan'),
  PARTIALLY_REFUNDED: t('Qisman qaytarilgan'),
};
