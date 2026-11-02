import { registerAs } from '@nestjs/config';

export default registerAs('scanner', () => ({
  host: process.env.CLAMAV_HOST ?? '',
  port: Number(process.env.CLAMAV_PORT ?? 3310),
  timeoutMs: Number(process.env.CLAMAV_TIMEOUT_MS ?? 60_000),
  // Skaner sozlanmagan bo‘lsa fayllarni tekshiruvsiz o‘tkazish (faqat ClamAV ishlatib bo‘lmaydigan kichik/sinov serverlari uchun).
  allowUnscanned: process.env.CLAMAV_ALLOW_UNSCANNED === 'true',
}));
