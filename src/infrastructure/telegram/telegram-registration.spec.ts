import { afterEach, describe, expect, it, vi } from 'vitest';
import { TelegramAlertService } from './telegram-alert.service';

function service(values: Record<string, unknown>) {
  const config = { get: (key: string, fallback?: unknown) => values[key] ?? fallback };
  const instance = new TelegramAlertService(config as never);
  instance.onModuleInit();
  return instance;
}

afterEach(() => vi.unstubAllGlobals());

describe('account verified notice (closed group)', () => {
  it('goes to the credentials chat/topic with role, name and login — and never contains a password', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const telegram = service({ 'telegram.botToken': 'T', 'telegram.credentialsChatId': '-300', 'telegram.credentialsThreadId': 52, 'app.name': 'GetMaster' });
    telegram.notifyAccountVerified({ phone: '+998901234567', name: 'Ali <Valiyev>', role: 'Usta' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body);
    expect(body).toMatchObject({ chat_id: '-300', message_thread_id: 52 });
    expect(body.text).toContain('hisob tasdiqlandi');
    expect(body.text).toContain('Akkaunt roli: <b>Usta</b>');
    expect(body.text).toContain('Ali &lt;Valiyev&gt;');
    expect(body.text).toContain('+998901234567');
    expect(body.text.toLowerCase()).not.toContain('parol');
  });

  it('does nothing when no credentials chat is configured', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    service({ 'telegram.botToken': 'T' }).notifyAccountVerified({ phone: '+998901234567', name: 'Ali' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('new account credentials (closed superadmin group)', () => {
  it('goes only to the credentials chat, escaped, and never to the error chat', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const telegram = service({
      'telegram.botToken': 'T',
      'telegram.chatId': '-100',
      'telegram.otpChatId': '-200',
      'telegram.credentialsChatId': '-300',
    });
    telegram.notifyNewCredentials({ phone: '+998901234567', name: 'Ali Valiyev', password: 'a<b>&Secret1', role: 'Usta' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body);
    expect(body.chat_id).toBe('-300');
    expect(body.text).toContain('+998901234567');
    expect(body.text).toContain('a&lt;b&gt;&amp;Secret1');
    expect(body.text).toContain('Akkaunt roli: <b>Usta</b>');
    expect(body.text).toContain('Ism familiya: Ali Valiyev');
  });

  it('is silent when no credentials chat is configured', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    service({ 'telegram.botToken': 'T' }).notifyNewCredentials({ phone: '+998901234567', name: '', password: 'x' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('credentials topic', () => {
  it('posts into the topic and falls back to the plain group when it is not a forum', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ description: 'Bad Request: message thread not found' }) })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const telegram = service({ 'telegram.botToken': 'T', 'telegram.credentialsChatId': '-1004399344660', 'telegram.credentialsThreadId': 52 });
    telegram.notifyNewCredentials({ phone: '+998901234567', name: 'Ali', password: 'x' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const first = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body);
    const second = JSON.parse((fetchMock.mock.calls[1]?.[1] as { body: string }).body);
    expect(first).toMatchObject({ chat_id: '-1004399344660', message_thread_id: 52 });
    expect(second.message_thread_id).toBeUndefined();
  });
});

describe('OTP topic', () => {
  it('sends OTP codes to the configured chat and topic', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const telegram = service({ 'telegram.botToken': 'T', 'telegram.otpChatId': '-1004399344660', 'telegram.otpThreadId': 61 });
    await telegram.sendOtp({ phone: '+998901234567', code: '123456', purposeLabel: 'Kirish', ttlMinutes: 5 });
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body);
    expect(body).toMatchObject({ chat_id: '-1004399344660', message_thread_id: 61 });
    expect(body.text).toContain('123456');
  });
});

describe('admin password change notice', () => {
  it('reports who changed whose password with the new login/password to the closed group topic', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const telegram = service({ 'telegram.botToken': 'T', 'telegram.credentialsChatId': '-1004399344660', 'telegram.credentialsThreadId': 52 });
    telegram.notifyPasswordChanged({
      adminName: 'Super Admin',
      adminAccount: 1,
      userName: 'Ali Valiyev',
      userAccount: 600,
      userRole: 'Usta',
      login: '+998901234567',
      password: 'N3w<Pass>',
      reason: 'Foydalanuvchi so‘rovi',
      ip: '10.0.0.1',
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body);
    expect(body).toMatchObject({ chat_id: '-1004399344660', message_thread_id: 52 });
    for (const part of ['Super Admin', 'ID 600', 'Usta', '+998901234567', 'N3w&lt;Pass&gt;', 'Foydalanuvchi so‘rovi', '10.0.0.1']) expect(body.text).toContain(part);
  });
});

describe('duplicate registration attempt notice', () => {
  it('reports device, IP and approximate location to the security topic (no password) and de-duplicates repeats', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).startsWith('https://ipwho.is/')) {
        return { ok: true, json: async () => ({ success: true, country: 'Uzbekistan', region: 'Tashkent', city: 'Tashkent', latitude: 41.3, longitude: 69.2, connection: { isp: 'Uztelecom' } }) };
      }
      return { ok: true };
    });
    vi.stubGlobal('fetch', fetchMock);
    const telegram = service({ 'telegram.botToken': 'T', 'telegram.credentialsChatId': '-1004399344660', 'telegram.credentialsThreadId': 52, 'telegram.securityThreadId': 64 });
    const attempt = {
      reason: 'phone' as const,
      phone: '+998901234567',
      name: 'Ali',
      ip: '85.115.240.10',
      panel: 'CUSTOMER',
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
    };
    telegram.notifyDuplicateRegistration(attempt);
    telegram.notifyDuplicateRegistration(attempt);
    await vi.waitFor(() => expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/sendMessage'))).toBe(true));
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).includes('/sendMessage'))).toHaveLength(1);
    const send = fetchMock.mock.calls.find((call) => String(call[0]).includes('/sendMessage'));
    const body = JSON.parse((send?.[1] as { body: string }).body);
    expect(body).toMatchObject({ chat_id: '-1004399344660', message_thread_id: 64 });
    for (const part of ['+998901234567', '85.115.240.10', 'Chrome · Android · telefon', 'Tashkent, Tashkent, Uzbekistan', 'Uztelecom', 'openstreetmap.org']) expect(body.text).toContain(part);
    expect(body.text.toLowerCase()).not.toContain('parol');
  });

  it('does not call the geo service for local network addresses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const telegram = service({ 'telegram.botToken': 'T', 'telegram.credentialsChatId': '-1' });
    telegram.notifyDuplicateRegistration({ reason: 'email', phone: '+998900000000', name: '', ip: '192.168.1.5' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls.every((call) => !String(call[0]).includes('ipwho.is'))).toBe(true);
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body);
    expect(body.text).toContain('lokal tarmoq');
  });
});

describe('duplicate attempt with device GPS', () => {
  it('posts the exact GPS point (when the user allowed it) and still adds the approximate IP place', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      String(url).startsWith('https://ipwho.is/')
        ? { ok: true, json: async () => ({ success: true, country: 'Uzbekistan', region: 'Tashkent', city: 'Tashkent', latitude: 41.3, longitude: 69.2 }) }
        : { ok: true },
    );
    vi.stubGlobal('fetch', fetchMock);
    const telegram = service({ 'telegram.botToken': 'T', 'telegram.credentialsChatId': '-1', 'telegram.securityThreadId': 64 });
    telegram.notifyDuplicateRegistration({
      reason: 'phone',
      phone: '+998901234567',
      name: '',
      ip: '85.115.240.11',
      location: { latitude: 41.311081, longitude: 69.240562, accuracy: 18.4 },
    });
    await vi.waitFor(() => expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/sendMessage'))).toBe(true));
    const send = fetchMock.mock.calls.find((call) => String(call[0]).includes('/sendMessage'));
    const body = JSON.parse((send?.[1] as { body: string }).body);
    expect(body.text).toContain('Aniq joylashuv (qurilma GPS');
    expect(body.text).toContain('https://www.google.com/maps?q=41.311081,69.240562');
    expect(body.text).toContain('±18 m');
    expect(body.text).toContain('IP bo‘yicha taxminiy joy: Tashkent, Tashkent, Uzbekistan');
  });

  it('labels the place as approximate when the device did not share GPS', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const telegram = service({ 'telegram.botToken': 'T', 'telegram.credentialsChatId': '-1' });
    telegram.notifyDuplicateRegistration({ reason: 'phone', phone: '+998901234568', name: '', ip: '192.168.0.4' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body);
    expect(body.text).toContain('Joylashuv (taxminiy, IP bo‘yicha)');
  });
});
