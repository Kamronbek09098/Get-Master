import { registerAs } from '@nestjs/config';

export default registerAs('telegram', () => ({
  botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  chatId: process.env.TELEGRAM_CHAT_ID ?? '',
  otpChatId: process.env.TELEGRAM_OTP_CHAT_ID ?? '',
  // OTP guruhi «mavzular» rejimida bo‘lsa — OTP kodlar yuboriladigan mavzu ID si.
  otpThreadId: process.env.TELEGRAM_OTP_THREAD_ID ? Number(process.env.TELEGRAM_OTP_THREAD_ID) : undefined,
  // Yangi foydalanuvchi login/paroli yuboriladigan YOPIQ guruh (faqat superadmin). Berilmasa OTP guruhi ishlatiladi.
  credentialsChatId: process.env.TELEGRAM_CREDENTIALS_CHAT_ID || process.env.TELEGRAM_OTP_CHAT_ID || '',
  // Guruh «mavzular» (topic) rejimida bo‘lsa — xabar yuboriladigan mavzu ID si (t.me/c/<guruh>/<mavzu> havolasidagi oxirgi son).
  credentialsThreadId: process.env.TELEGRAM_CREDENTIALS_THREAD_ID ? Number(process.env.TELEGRAM_CREDENTIALS_THREAD_ID) : undefined,
  // Xavfsizlik hodisalari (masalan, mavjud raqam bilan ro‘yxatdan o‘tishga urinish) uchun mavzu ID si; bo‘sh bo‘lsa credentials mavzusi ishlatiladi.
  securityThreadId: process.env.TELEGRAM_SECURITY_THREAD_ID ? Number(process.env.TELEGRAM_SECURITY_THREAD_ID) : undefined,
  // Foydalanuvchilarning kirish/chiqish hodisalari mavzusi.
  sessionsThreadId: process.env.TELEGRAM_SESSIONS_THREAD_ID ? Number(process.env.TELEGRAM_SESSIONS_THREAD_ID) : undefined,
  minStatus: Number(process.env.TELEGRAM_ALERT_MIN_STATUS ?? 500),
  dedupeWindowMs: Number(process.env.TELEGRAM_ALERT_DEDUPE_SECONDS ?? 300) * 1000,
  timeoutMs: 8_000,
  retryDelayMs: 800,
}));
