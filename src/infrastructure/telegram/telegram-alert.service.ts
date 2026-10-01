import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describeDevice, isPrivateIp, lookupIpLocation } from '../../common/utils/geo-ip';

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
  private otpThreadId: number | undefined;
  private credentialsChatId = '';
  private credentialsThreadId: number | undefined;
  private securityThreadId: number | undefined;
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
    this.otpThreadId = this.config.get<number | undefined>('telegram.otpThreadId', undefined);
    this.credentialsChatId = this.config.get<string>('telegram.credentialsChatId', '');
    this.credentialsThreadId = this.config.get<number | undefined>('telegram.credentialsThreadId', undefined);
    this.securityThreadId = this.config.get<number | undefined>('telegram.securityThreadId', undefined);
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
    return this.post(this.otpChatId, text, `OTP (${input.purposeLabel})`, this.otpThreadId);
  }

  /**
   * Yangi foydalanuvchining login va paroli — FAQAT yopiq (superadmin) guruhga. Parol bazada baribir faqat bcrypt xesh sifatida saqlanadi.
   * Xabar matni hech qayerda loglanmaydi (post() faqat yorliqni yozadi).
   */
  notifyNewCredentials(input: { phone: string; name: string; password: string; role?: string }): void {
    if (!this.botToken || !this.credentialsChatId) return;
    const text = [
      `🔐 <b>${escapeHtml(this.appName)}</b> [${escapeHtml(this.environment)}] — yangi hisob (kod tasdiqlanishi kutilmoqda)`,
      `Akkaunt roli: <b>${escapeHtml(input.role ?? 'Mijoz')}</b>`,
      `Ism familiya: ${input.name ? escapeHtml(input.name) : '—'}`,
      `Login: <code>${escapeHtml(input.phone)}</code>`,
      `Parol: <code>${escapeHtml(input.password)}</code>`,
      '⚠️ Maxfiy ma’lumot — faqat superadmin uchun.',
    ]
      .filter((line): line is string => !!line)
      .join('\n');
    void this.post(this.credentialsChatId, text, 'yangi hisob ma’lumotlari', this.credentialsThreadId);
  }

  /**
   * Admin foydalanuvchi parolini o‘zgartirganda: kim, kimning, qachon, sababi va yangi login/parol — yopiq guruhga.
   * Parol bazada baribir faqat bcrypt xesh sifatida saqlanadi; matn hech qayerda loglanmaydi.
   */
  notifyPasswordChanged(input: {
    adminName: string;
    adminAccount: number;
    userName: string;
    userAccount: number;
    userRole: string;
    login: string;
    password: string;
    reason?: string | null;
    ip?: string | null;
  }): void {
    if (!this.botToken || !this.credentialsChatId) return;
    const text = [
      `🔑 <b>${escapeHtml(this.appName)}</b> [${escapeHtml(this.environment)}] — admin foydalanuvchi parolini o‘zgartirdi`,
      `Kim o‘zgartirdi: <b>${escapeHtml(input.adminName || '—')}</b> (ID ${input.adminAccount})`,
      `Akkaunt: <b>${escapeHtml(input.userName || '—')}</b> (ID ${input.userAccount}), roli: <b>${escapeHtml(input.userRole)}</b>`,
      `Login: <code>${escapeHtml(input.login)}</code>`,
      `Yangi parol: <code>${escapeHtml(input.password)}</code>`,
      input.reason ? `Sabab: ${escapeHtml(input.reason)}` : undefined,
      input.ip ? `IP: <code>${escapeHtml(input.ip)}</code>` : undefined,
      `Vaqt: ${escapeHtml(new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }))}`,
      '⚠️ Maxfiy ma’lumot — faqat superadmin uchun. Foydalanuvchi barcha qurilmalardan chiqarildi.',
    ]
      .filter((line): line is string => !!line)
      .join('\n');
    void this.post(this.credentialsChatId, text, 'parol o‘zgartirildi', this.credentialsThreadId);
  }

  /**
   * Mavjud telefon/email bilan yangi hisob ochishga urinish haqida adminga xabar (yopiq guruh). Urinishda yozilgan parol yuborilmaydi.
   * Bir xil raqam+IP uchun takroriy xabarlar `dedupeWindowMs` davomida bostiriladi.
   */
  notifyDuplicateRegistration(input: {
    reason: 'phone' | 'email';
    phone: string;
    email?: string | null;
    name: string;
    ip?: string | null;
    panel?: string | null;
    userAgent?: string | null;
    /** Qurilma GPS si (foydalanuvchi ruxsat bergan bo‘lsa). */
    location?: { latitude: number; longitude: number; accuracy?: number } | null;
  }): void {
    if (!this.botToken || !this.credentialsChatId) return;
    if (!this.shouldSend(`dup:${input.reason}:${input.phone}:${input.ip ?? ''}`)) return;
    void this.sendDuplicateRegistration(input);
  }

  private async sendDuplicateRegistration(input: Parameters<TelegramAlertService['notifyDuplicateRegistration']>[0]): Promise<void> {
    const gps = input.location ?? null;
    const location = input.ip ? await lookupIpLocation(input.ip) : null;
    const where = location
      ? [location.city, location.region, location.country].filter(Boolean).join(', ')
      : input.ip && isPrivateIp(input.ip)
        ? 'lokal tarmoq (joylashuvni aniqlab bo‘lmaydi)'
        : 'aniqlanmadi';
    const ipMap = location && (location.latitude || location.longitude) ? `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=11/${location.latitude}/${location.longitude}` : null;
    const gpsMap = gps ? `https://www.google.com/maps?q=${gps.latitude},${gps.longitude}` : null;
    const locationLine = gps
      ? `📍 Aniq joylashuv (qurilma GPS, foydalanuvchi ruxsati bilan): <a href="${gpsMap}">${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}</a>${gps.accuracy ? ` (±${Math.round(gps.accuracy)} m)` : ''}`
      : `Joylashuv (taxminiy, IP bo‘yicha): ${escapeHtml(where)}${ipMap ? ` — <a href="${ipMap}">xaritada</a>` : ''}`;
    const text = [
      `⚠️ <b>${escapeHtml(this.appName)}</b> [${escapeHtml(this.environment)}] — mavjud ma’lumot bilan ro‘yxatdan o‘tishga urinish`,
      input.reason === 'phone' ? 'Sabab: telefon raqami allaqachon ro‘yxatdan o‘tgan' : 'Sabab: email allaqachon ro‘yxatdan o‘tgan',
      `Telefon: <code>${escapeHtml(input.phone)}</code>`,
      input.email ? `Email: <code>${escapeHtml(input.email)}</code>` : undefined,
      `Kiritilgan ism: ${input.name ? escapeHtml(input.name) : '—'}`,
      `Qurilma: ${escapeHtml(describeDevice(input.userAgent))}${input.panel ? ` (panel: ${escapeHtml(input.panel)})` : ''}`,
      `IP manzil: <code>${escapeHtml(input.ip ?? 'noma’lum')}</code>`,
      locationLine,
      gps && where !== 'aniqlanmadi' ? `IP bo‘yicha taxminiy joy: ${escapeHtml(where)}` : undefined,
      location?.provider ? `Internet provayder: ${escapeHtml(location.provider)}` : undefined,
      `Vaqt: ${escapeHtml(new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }))}`,
      'Foydalanuvchiga hech narsa bildirilmadi (raqam mavjudligi sir saqlanadi); hisob ochilmadi.',
    ]
      .filter((line): line is string => !!line)
      .join('\n');
    await this.post(this.credentialsChatId, text, 'takroriy ro‘yxatdan o‘tish urinishi', this.securityThreadId ?? this.credentialsThreadId);
  }

  /** Telefon kod bilan tasdiqlangach: hisob haqida xabar (yopiq guruhga). Parol bu xabarda yo‘q — bazada faqat xesh bor. */
  notifyAccountVerified(input: { phone: string; name: string; role?: string }): void {
    if (!this.botToken || !this.credentialsChatId) return;
    const text = [
      `✅ <b>${escapeHtml(this.appName)}</b> [${escapeHtml(this.environment)}] — hisob tasdiqlandi`,
      `Akkaunt roli: <b>${escapeHtml(input.role ?? 'Mijoz')}</b>`,
      `Ism familiya: ${input.name ? escapeHtml(input.name) : '—'}`,
      `Login: <code>${escapeHtml(input.phone)}</code>`,
      'Telefon raqami kod bilan tasdiqlandi, hisob faol.',
    ].join('\n');
    void this.post(this.credentialsChatId, text, 'hisob tasdiqlandi', this.credentialsThreadId);
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

  private async post(chatId: string, text: string, label = 'xabar', threadId?: number): Promise<boolean> {
    let thread = threadId;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const outcome = await this.postOnce(chatId, text, thread);
      // Guruh «mavzular» rejimida emas bo‘lsa — mavzusiz qayta yuboriladi.
      if (outcome === 'bad-thread' && thread !== undefined) {
        thread = undefined;
        continue;
      }
      if (outcome === 'sent') {
        this.logger.log(`Telegram’ga yuborildi: ${label}${attempt > 1 ? ` (${attempt}-urinishda)` : ''}.`);
        return true;
      }
      if (outcome === 'rejected' || attempt === MAX_ATTEMPTS) return false;
      await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * attempt));
    }
    return false;
  }

  private async postOnce(chatId: string, text: string, threadId?: number): Promise<'sent' | 'rejected' | 'retry' | 'bad-thread'> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(threadId !== undefined ? { message_thread_id: threadId } : {}) }),
        signal: controller.signal,
      });
      if (response.ok) return 'sent';
      if (response.status === 400 && threadId !== undefined) {
        const info = (await response.json().catch(() => null)) as { description?: string } | null;
        if (/thread/i.test(info?.description ?? '')) return 'bad-thread';
      }
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
