import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  name: process.env.APP_NAME ?? 'GetMaster',
  environment: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  // TRUST_PROXY: bo‘sh/false — proksi yo‘q; true — barcha proksilarga ishonish (faqat ishonchli muhitda);
  // son (masalan 1) — shuncha proksi qatlami; 'loopback' — faqat shu kompyuterdagi proksi (masalan, cloudflared tunnel).
  trustProxy: ((): boolean | number | string => {
    const raw = (process.env.TRUST_PROXY ?? '').trim();
    if (!raw || raw === 'false') return false;
    if (raw === 'true') return true;
    return /^\d+$/.test(raw) ? Number(raw) : raw;
  })(),
}));
