import { registerAs } from '@nestjs/config';

export default registerAs('telegram', () => ({
  botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  chatId: process.env.TELEGRAM_CHAT_ID ?? '',
  otpChatId: process.env.TELEGRAM_OTP_CHAT_ID ?? '',
  minStatus: Number(process.env.TELEGRAM_ALERT_MIN_STATUS ?? 500),
  dedupeWindowMs: Number(process.env.TELEGRAM_ALERT_DEDUPE_SECONDS ?? 300) * 1000,
  timeoutMs: 8_000,
  retryDelayMs: 800,
}));
