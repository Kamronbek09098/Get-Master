import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ErrorAlert {
  status: number;
  code: string;
  message: string;
  method?: string;
  path?: string;
  requestId?: string | null;
  stack?: string;
}

const MAX_ATTEMPTS = 3;
const MAX_MESSAGE_LENGTH = 3800;
const MAX_STACK_LINES = 6;
const MAX_TRACKED_KEYS = 500;

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

@Injectable()
export class TelegramAlertService implements OnModuleInit {
  private readonly logger = new Logger(TelegramAlertService.name);
  private botToken = '';
  private chatId = '';
  private otpChatId = '';
  private minStatus = 500;
  private dedupeWindowMs = 300_000;
  private timeoutMs = 8_000;
  private retryDelayMs = 800;
  private environment = 'development';
  private appName = 'GetMaster';
  private readonly lastSent = new Map<string, number>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.botToken = this.config.get<string>('telegram.botToken', '');
    this.chatId = this.config.get<string>('telegram.chatId', '');
    this.otpChatId = this.config.get<string>('telegram.otpChatId', '');
    this.minStatus = this.config.get<number>('telegram.minStatus', 500);
    this.dedupeWindowMs = this.config.get<number>('telegram.dedupeWindowMs', 300_000);
    this.timeoutMs = this.config.get<number>('telegram.timeoutMs', 8_000);
    this.retryDelayMs = this.config.get<number>('telegram.retryDelayMs', 800);
    this.environment = this.config.get<string>('app.environment', 'development');
    this.appName = this.config.get<string>('app.name', 'GetMaster');
    if (!this.isEnabled()) {
      this.logger.warn('TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID sozlanmagan — Telegram xato xabarlari O‘CHIRILGAN.');
    }
    if (!this.isOtpEnabled()) {
      this.logger.warn('TELEGRAM_BOT_TOKEN/TELEGRAM_OTP_CHAT_ID sozlanmagan — OTP kodlar Telegram’ga YUBORILMAYDI.');
    }
  }

  isOtpEnabled(): boolean {
    return !!this.botToken && !!this.otpChatId;
  }

  async sendOtp(input: { phone: string; code: string; purposeLabel: string; ttlMinutes: number }): Promise<boolean> {
    if (!this.isOtpEnabled()) return false;
    const text = [
      `🔐 <b>${escapeHtml(this.appName)}</b> [${escapeHtml(this.environment)}] — ${escapeHtml(input.purposeLabel)}`,
      `Telefon: <code>${escapeHtml(input.phone)}</code>`,
      `Kod: <code>${escapeHtml(input.code)}</code>`,
      `Amal qilish muddati: ${input.ttlMinutes} daqiqa`,
    ].join('\n');
    return this.post(this.otpChatId, text, `OTP (${input.purposeLabel})`);
  }

  isEnabled(): boolean {
    return !!this.botToken && !!this.chatId;
  }

  notifyError(alert: ErrorAlert): void {
    if (!this.isEnabled() || alert.status < this.minStatus) return;
    const key = `${alert.method ?? ''} ${alert.path ?? ''} ${alert.code} ${alert.message}`;
    if (!this.shouldSend(key)) return;
    void this.post(this.chatId, this.format(alert), `xato ${alert.status} ${alert.code}`);
  }

  private shouldSend(key: string): boolean {
    const now = Date.now();
    const last = this.lastSent.get(key);
    if (last !== undefined && now - last < this.dedupeWindowMs) return false;
    if (this.lastSent.size >= MAX_TRACKED_KEYS) {
      for (const [storedKey, at] of this.lastSent) {
        if (now - at >= this.dedupeWindowMs) this.lastSent.delete(storedKey);
      }
      if (this.lastSent.size >= MAX_TRACKED_KEYS) this.lastSent.clear();
    }
    this.lastSent.set(key, now);
    return true;
  }

  private format(alert: ErrorAlert): string {
    const path = alert.path?.split('?')[0];
    const lines = [
      `🚨 <b>${escapeHtml(this.appName)}</b> [${escapeHtml(this.environment)}] — ${alert.status} ${escapeHtml(alert.code)}`,
      alert.method && path ? `<b>${escapeHtml(alert.method)}</b> <code>${escapeHtml(path)}</code>` : undefined,
      `Xabar: ${escapeHtml(alert.message)}`,
      alert.requestId ? `Request ID: <code>${escapeHtml(alert.requestId)}</code>` : undefined,
      alert.stack ? `<pre>${escapeHtml(alert.stack.split('\n').slice(0, MAX_STACK_LINES).join('\n'))}</pre>` : undefined,
    ].filter((line): line is string => !!line);
    const text = lines.join('\n');
    return text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH)}…` : text;
  }

  private async post(chatId: string, text: string, label = 'xabar'): Promise<boolean> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const outcome = await this.postOnce(chatId, text);
      if (outcome === 'sent') {
        this.logger.log(`Telegram’ga yuborildi: ${label}${attempt > 1 ? ` (${attempt}-urinishda)` : ''}.`);
        return true;
      }
      if (outcome === 'rejected' || attempt === MAX_ATTEMPTS) return false;
      await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * attempt));
    }
    return false;
  }

  private async postOnce(chatId: string, text: string): Promise<'sent' | 'rejected' | 'retry'> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
        signal: controller.signal,
      });
      if (response.ok) return 'sent';
      this.logger.warn(`Telegram xabarni qabul qilmadi (HTTP ${response.status}).`);
      return response.status === 429 || response.status >= 500 ? 'retry' : 'rejected';
    } catch (error) {
      const cause = (error as { cause?: { code?: string } }).cause?.code;
      const detail = (error as Error).message.split(this.botToken).join('***').slice(0, 120);
      this.logger.warn(`Telegram’ga yuborib bo‘lmadi (${(error as Error).name}${cause ? `: ${cause}` : ''}: ${detail}).`);
      return 'retry';
    } finally {
      clearTimeout(timer);
    }
  }
}
