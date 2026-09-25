import { registerAs } from '@nestjs/config';

export default registerAs('payment', () => ({
  baseUrl: process.env.PAYMENT_PROVIDER_BASE_URL ?? '',
  apiKey: process.env.PAYMENT_PROVIDER_API_KEY ?? '',
  click: {
    merchantId: process.env.CLICK_MERCHANT_ID ?? '',
    serviceId: process.env.CLICK_SERVICE_ID ?? '',
    secretKey: process.env.CLICK_SECRET_KEY ?? '',
  },
  payme: {
    merchantId: process.env.PAYME_MERCHANT_ID ?? '',
    secretKey: process.env.PAYME_SECRET_KEY ?? '',
  },
  uzum: {
    merchantId: process.env.UZUM_MERCHANT_ID ?? '',
    secretKey: process.env.UZUM_SECRET_KEY ?? '',
  },
}));
