import { registerAs } from '@nestjs/config';

export default registerAs('payment', () => ({
  baseUrl: process.env.PAYMENT_PROVIDER_BASE_URL ?? '',
  apiKey: process.env.PAYMENT_PROVIDER_API_KEY ?? '',
  returnUrl: process.env.PAYMENT_RETURN_URL || (process.env.CORS_ORIGINS ?? '').split(',')[0]?.trim() || '',
  /** Platforma komissiyasi ulushi (0.03 = 3%) — sof tushumdan ilova foydasini hisoblash uchun. */
  platformCommissionRate: Number(process.env.PLATFORM_COMMISSION_RATE ?? 0.03),
  click: {
    merchantId: process.env.CLICK_MERCHANT_ID ?? '',
    serviceId: process.env.CLICK_SERVICE_ID ?? '',
    secretKey: process.env.CLICK_SECRET_KEY ?? '',
  },
  payme: {
    merchantId: process.env.PAYME_MERCHANT_ID ?? '',
    secretKey: process.env.PAYME_SECRET_KEY ?? '',
    testMode: process.env.PAYME_TEST_MODE !== 'false',
  },
  uzum: {
    merchantId: process.env.UZUM_MERCHANT_ID ?? '',
    secretKey: process.env.UZUM_SECRET_KEY ?? '',
  },
}));
