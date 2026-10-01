import * as bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { TelegramAlertService } from '../../src/infrastructure/telegram/telegram-alert.service';
import { bootHarness, type Harness, uniquePhone } from '../helpers/harness';
import { RedisService } from '../../src/infrastructure/redis/redis.service';

let h: Harness;
beforeAll(async () => {
  h = await bootHarness();
});
afterAll(async () => {
  await h.close();
});

const PASSWORD = 'CorrectHorse-9';

async function policyIds(): Promise<string[]> {
  const rows = await h.db.policyVersion.findMany({ where: { status: 'PUBLISHED' }, select: { id: true } });
  return rows.map((r) => r.id);
}

async function setOtp(phone: string, purpose: string, code: string): Promise<void> {
  const row = await h.db.otpCode.findFirstOrThrow({ where: { phone, purpose: purpose as any, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
  await h.db.otpCode.update({ where: { id: row.id }, data: { codeHash: await bcrypt.hash(code, 4) } });
}

function cookiesOf(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of headers.getSetCookie()) {
    const [pair] = line.split(';');
    const [name, ...rest] = pair!.split('=');
    out[name!.trim()] = rest.join('=');
  }
  return out;
}

async function registerAndActivate(ip?: string) {
  const phone = uniquePhone();
  const reg = await h.api('POST', '/auth/register', { ip, body: { phone, password: PASSWORD, firstName: 'Test', lastName: 'User', acceptedPolicyIds: await policyIds() } });
  expect(reg.status).toBe(201);
  await setOtp(phone, 'REGISTER', '123456');
  const verified = await h.api('POST', '/auth/verify-registration', { ip, body: { phone, code: '123456' } });
  expect(verified.status).toBe(201);
  return phone;
}

async function login(phone: string, ip: string) {
  const step1 = await h.api('POST', '/auth/login', { ip, body: { phone, password: PASSWORD } });
  expect(step1.status).toBe(201);
  expect(step1.data).toMatchObject({ verificationRequired: true });
  expect(step1.data.developmentCode).toBeUndefined();
  await setOtp(phone, 'LOGIN', '654321');
  return h.api('POST', '/auth/verify-otp', { ip, body: { phone, code: '654321' } });
}

describe('K02b — phone numbers cannot be enumerated', () => {
  it('login-OTP verification answers identically for an unknown phone and a real account (same status and message)', async () => {
    const ip = '10.1.0.40';
    const phone = await registerAndActivate(ip);
    const real = await h.api('POST', '/auth/verify-otp', { ip, body: { phone, code: '000000' } });
    const ghost = await h.api('POST', '/auth/verify-otp', { ip, body: { phone: uniquePhone(), code: '000000' } });
    expect(ghost.status).toBe(real.status);
    expect(ghost.body.message).toBe(real.body.message);
  });

  it('registration-OTP verification answers identically for unknown phones and activated accounts', async () => {
    const ip = '10.1.0.41';
    const phone = await registerAndActivate(ip);
    const active = await h.api('POST', '/auth/verify-registration', { ip, body: { phone, code: '000000' } });
    const ghost = await h.api('POST', '/auth/verify-registration', { ip, body: { phone: uniquePhone(), code: '000000' } });
    expect(ghost.status).toBe(active.status);
    expect(ghost.body.message).toBe(active.body.message);
  });

  it('login for an unknown phone takes a comparable time to a wrong password on a real account (no instant rejection)', async () => {
    const ip = '10.1.0.42';
    const phone = await registerAndActivate(ip);
    const time = async (p: string, address: string) => {
      const started = Date.now();
      await h.api('POST', '/auth/login', { ip: address, body: { phone: p, password: 'WrongPassword-1' } });
      return Date.now() - started;
    };
    await time(phone, '10.1.0.43'); // isinish
    const real = await time(phone, '10.1.0.44');
    const ghost = await time(uniquePhone(), '10.1.0.45');
    expect(ghost).toBeGreaterThan(real * 0.5);
  });
});

describe('K02d — OTP messages go to the OTP Telegram topic in every legitimate flow', () => {
  it('sends a code for: new registration, resend while pending, and login of an existing account — and for nothing else', async () => {
    const telegram = h.app.get(TelegramAlertService);
    const spy = vi.spyOn(telegram, 'sendOtp').mockResolvedValue(true);
    const labels = () => spy.mock.calls.map((call) => call[0].purposeLabel);
    try {
      const ip = '10.1.0.70';
      const phone = uniquePhone();
      // 1) Yangi raqam bilan ro‘yxatdan o‘tish
      await h.api('POST', '/auth/register', { ip, body: { phone, password: PASSWORD, firstName: 'Test', lastName: 'User', acceptedPolicyIds: await policyIds() } });
      await vi.waitFor(() => expect(labels()).toContain('Ro‘yxatdan o‘tish'));
      // 2) Hali tasdiqlanmagan raqam uchun kodni qayta yuborish
      await h.db.otpCode.updateMany({ where: { phone }, data: { createdAt: new Date(Date.now() - 600_000) } });
      await h.api('POST', '/auth/resend-registration', { ip: '10.1.0.71', body: { phone } });
      await vi.waitFor(() => expect(labels()).toContain('Ro‘yxatdan o‘tish (kod qayta yuborildi)'));
      // 3) Mavjud (faol) akkauntga kirish
      await setOtp(phone, 'REGISTER', '123456');
      await h.api('POST', '/auth/verify-registration', { ip, body: { phone, code: '123456' } });
      spy.mockClear();
      await h.api('POST', '/auth/login', { ip: '10.1.0.72', body: { phone, password: PASSWORD } });
      await vi.waitFor(() => expect(labels()).toEqual(['Tizimga kirish']));
      // Boshqa holatlar: mavjud raqam bilan ro‘yxatdan o‘tish urinishi (soxta), noto‘g‘ri parol, mavjud bo‘lmagan raqam — kod yuborilmaydi.
      spy.mockClear();
      await h.api('POST', '/auth/register', { ip: '10.1.0.73', body: { phone, password: 'Wrong-Pass-123', firstName: 'X', lastName: 'Y', acceptedPolicyIds: await policyIds() } });
      await h.api('POST', '/auth/login', { ip: '10.1.0.74', body: { phone, password: 'Wrong-Pass-123' } });
      await h.api('POST', '/auth/login', { ip: '10.1.0.75', body: { phone: uniquePhone(), password: PASSWORD } });
      await h.api('POST', '/auth/resend-registration', { ip: '10.1.0.76', body: { phone: uniquePhone() } });
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('K02c — resending the registration code', () => {
  it('a PENDING account gets a fresh code and can then verify; unknown/active phones get the same answer but no code', async () => {
    const ip = '10.1.0.60';
    const phone = uniquePhone();
    await h.api('POST', '/auth/register', { ip, body: { phone, password: PASSWORD, firstName: 'Test', lastName: 'User', acceptedPolicyIds: await policyIds() } });
    await h.db.otpCode.updateMany({ where: { phone }, data: { status: 'EXPIRED', expiresAt: new Date(Date.now() - 1000), createdAt: new Date(Date.now() - 600_000) } }); // kod eskirdi (kutish vaqti ham o‘tgan)
    const before = await h.db.otpCode.count({ where: { phone } });

    const resend = await h.api('POST', '/auth/resend-registration', { ip, body: { phone } });
    expect(resend.status, JSON.stringify(resend.body)).toBe(201);
    expect(resend.data).toMatchObject({ verificationRequired: true });
    expect(await h.db.otpCode.count({ where: { phone } })).toBe(before + 1);
    await setOtp(phone, 'REGISTER', '654321');
    const verified = await h.api('POST', '/auth/verify-registration', { ip, body: { phone, code: '654321' } });
    expect(verified.status, JSON.stringify(verified.body)).toBe(201);

    // Tasdiqlangan (faol) va mavjud bo‘lmagan raqam: javob bir xil, kod yaratilmaydi.
    const ghost = uniquePhone();
    const active = await registerAndActivate('10.1.0.65');
    const forActive = await h.api('POST', '/auth/resend-registration', { ip: '10.1.0.61', body: { phone: active } });
    const forGhost = await h.api('POST', '/auth/resend-registration', { ip: '10.1.0.62', body: { phone: ghost } });
    expect(forActive.status).toBe(forGhost.status);
    expect(forActive.data).toEqual(forGhost.data);
    expect(await h.db.otpCode.count({ where: { phone: ghost } })).toBe(0);
    expect(await h.db.otpCode.count({ where: { phone: active, status: 'ACTIVE' } })).toBe(0); // faol hisobga yangi kod yuborilmaydi
  });

  it('applies one cooldown to every phone alike (no way to tell a pending number from an unknown one)', async () => {
    const ghost = uniquePhone();
    const first = await h.api('POST', '/auth/resend-registration', { ip: '10.1.0.63', body: { phone: ghost } });
    const second = await h.api('POST', '/auth/resend-registration', { ip: '10.1.0.64', body: { phone: ghost } });
    expect(first.status).toBe(201);
    expect(second.status).toBe(429);
    expect(second.body.message).toMatch(/\d+ soniya kuting/);
  });
});

describe('K02 — registration & login', () => {
  it('rejects registration without the mandatory policies', async () => {
    const res = await h.api('POST', '/auth/register', { ip: '10.1.0.1', body: { phone: uniquePhone(), password: PASSWORD, firstName: 'Test', lastName: 'User', acceptedPolicyIds: [] } });
    expect(res.status).toBe(400);
  });

  it('rejects registration without first and last name, or with blank ones', async () => {
    const policies = await policyIds();
    const attempt = (extra: Record<string, string>, ip: string) =>
      h.api('POST', '/auth/register', { ip, body: { phone: uniquePhone(), password: PASSWORD, acceptedPolicyIds: policies, ...extra } });
    expect((await attempt({}, '10.1.7.1')).status).toBe(400);
    expect((await attempt({ firstName: 'Ali' }, '10.1.7.2')).status).toBe(400);
    expect((await attempt({ firstName: 'Ali', lastName: '   ' }, '10.1.7.3')).status).toBe(400);
  });

  it('registers PENDING → verifies OTP → ACTIVE, and refuses duplicates', async () => {
    const ip = '10.1.0.2';
    const phone = await registerAndActivate(ip);
    const user = await h.db.user.findUniqueOrThrow({ where: { phone } });
    expect(user.status).toBe('ACTIVE');
    expect(user.phoneVerifiedAt).not.toBeNull();
    expect(user.passwordHash).not.toContain(PASSWORD);
    const before = user.accountNumber;
    const registerAgain = async (password: string, extraIp: string) =>
      h.api('POST', '/auth/register', { ip: extraIp, body: { phone, password, firstName: 'Test', lastName: 'User', acceptedPolicyIds: await policyIds() } });
    // Parol mos kelmasa: «band» deb aytilmaydi — yangi ro‘yxatdan o‘tishdan farq qilmaydigan javob, hisob ham, kod ham yaratilmaydi.
    const otpBefore = await h.db.otpCode.count({ where: { phone } });
    const decoy = await registerAgain('WrongPassword-1', ip);
    expect(decoy.status).toBe(201);
    expect(decoy.data).toMatchObject({ verificationRequired: true });
    expect(Object.keys(decoy.data).sort()).toEqual(['userId', 'verificationRequired']);
    expect(decoy.data.existingAccount).toBeUndefined();
    expect(JSON.stringify(decoy.body)).not.toMatch(/allaqachon|already/i);
    expect(await h.db.otpCode.count({ where: { phone } })).toBe(otpBefore);
    expect(await h.db.user.count({ where: { phone } })).toBe(1);
    // Admin uchun audit yozuvi qoldiriladi.
    await vi.waitFor(async () => expect(await h.db.auditLog.count({ where: { action: 'AUTH_REGISTER_DUPLICATE_ATTEMPT', targetId: user.id } })).toBeGreaterThan(0));
    const again = await registerAgain(PASSWORD, '10.1.0.22');
    expect(again.status).toBe(201);
    expect(again.data).toMatchObject({ existingAccount: true, accountNumber: before, verificationRequired: true });
    expect(await h.db.user.count({ where: { phone } })).toBe(1);
  });

  it('login never reveals whether a phone exists (same 401 for bad password and unknown user)', async () => {
    const ip = '10.1.0.3';
    const phone = await registerAndActivate(ip);
    const wrong = await h.api('POST', '/auth/login', { ip, body: { phone, password: 'WrongPassword-1' } });
    const ghost = await h.api('POST', '/auth/login', { ip, body: { phone: uniquePhone(), password: 'WrongPassword-1' } });
    expect(wrong.status).toBe(401);
    expect(ghost.status).toBe(401);
    expect(wrong.body.message).toBe(ghost.body.message);
  });

  it('a PENDING (unverified) account cannot log in', async () => {
    const phone = uniquePhone();
    await h.api('POST', '/auth/register', { ip: '10.1.0.4', body: { phone, password: PASSWORD, firstName: 'Test', lastName: 'User', acceptedPolicyIds: await policyIds() } });
    const res = await h.api('POST', '/auth/login', { ip: '10.1.0.4', body: { phone, password: PASSWORD } });
    expect(res.status).toBe(403);
  });

  it('issues httpOnly, SameSite cookies and the session works end-to-end', async () => {
    const ip = '10.1.0.5';
    const phone = await registerAndActivate(ip);
    const res = await login(phone, ip);
    expect(res.status).toBe(201);
    const setCookie = res.headers.getSetCookie().join('\n');
    expect(setCookie).toMatch(/accessToken=.*HttpOnly/i);
    expect(setCookie).toMatch(/refreshToken=.*HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(JSON.stringify(res.body)).not.toMatch(/eyJ/);
    const c = cookiesOf(res.headers);
    const me = await h.api('GET', '/customers/me', { cookie: `accessToken=${c.accessToken}` });
    expect(me.status).toBe(200);
    expect(me.data.phone).toBe(phone);
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash/);
  });

  it('a session lasts 30 minutes: refresh token, its cookie and its DB row all expire in 30 min, but the device cookie outlives it', async () => {
    const ip = '10.1.3.1';
    const phone = await registerAndActivate(ip);
    const res = await login(phone, ip);
    expect(res.status).toBe(201);
    const maxAge = (name: string) => {
      const line = res.headers.getSetCookie().find((cookie) => cookie.startsWith(`${name}=`));
      return Number(/Max-Age=(\d+)/i.exec(line ?? '')?.[1]);
    };
    expect(maxAge('refreshToken')).toBe(30 * 60);
    expect(maxAge('accessToken')).toBe(15 * 60);
    expect(maxAge('deviceId')).toBe(30 * 86_400);

    const user = await h.db.user.findUniqueOrThrow({ where: { phone } });
    const row = await h.db.refreshToken.findFirstOrThrow({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    const minutes = (row.expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(29);
    expect(minutes).toBeLessThanOrEqual(30);
  });

  it('every refresh starts a fresh 30 minutes (an active user stays signed in)', async () => {
    const ip = '10.1.3.2';
    const phone = await registerAndActivate(ip);
    const c = cookiesOf((await login(phone, ip)).headers);
    const user = await h.db.user.findUniqueOrThrow({ where: { phone } });
    await h.db.refreshToken.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() + 60_000) } });
    const refreshed = await h.api('POST', '/auth/refresh', { ip, cookie: `refreshToken=${c.refreshToken}; deviceId=${c.deviceId}` });
    expect(refreshed.status).toBe(201);
    const latest = await h.db.refreshToken.findFirstOrThrow({ where: { userId: user.id, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
    expect((latest.expiresAt.getTime() - Date.now()) / 60_000).toBeGreaterThan(29);
  });

  describe('sessions are isolated per panel (customer / master / admin share one browser)', () => {
    const asPanel = (panel: string) => ({ 'x-app-panel': panel });

    async function panelLogin(phone: string, panel: string, ip: string) {
      const headers = asPanel(panel);
      await h.db.otpCode.deleteMany({ where: { phone } });
      expect((await h.api('POST', '/auth/login', { ip, headers, body: { phone, password: PASSWORD } })).status).toBe(201);
      await setOtp(phone, 'LOGIN', '654321');
      return h.api('POST', '/auth/verify-otp', { ip, headers, body: { phone, code: '654321' } });
    }
    const cookieHeader = (res: { headers: Headers }, names: string[]) => {
      const all = cookiesOf(res.headers);
      return names.map((name) => `${name}=${all[name]}`).join('; ');
    };

    it('login sets cookies named after the panel and never the plain ones', async () => {
      const ip = '10.1.6.1';
      const phone = await registerAndActivate(ip);
      const res = await panelLogin(phone, 'MASTER', ip);
      const names = res.headers.getSetCookie().map((line) => line.split('=')[0]);
      expect(names).toEqual(expect.arrayContaining(['accessToken_master', 'refreshToken_master', 'deviceId_master']));
      expect(names).not.toContain('accessToken');
      expect(names).not.toContain('refreshToken');
    });

    it('two different accounts can be signed in on two panels at once, each seeing only its own account', async () => {
      const ipA = '10.1.6.2';
      const ipB = '10.1.6.3';
      const customerPhone = await registerAndActivate(ipA);
      const masterPhone = await registerAndActivate(ipB);
      const customerLogin = await panelLogin(customerPhone, 'CUSTOMER', ipA);
      const masterLogin = await panelLogin(masterPhone, 'MASTER', ipB);
      const browserCookies = `${cookieHeader(customerLogin, ['accessToken_customer'])}; ${cookieHeader(masterLogin, ['accessToken_master'])}`;

      const asCustomer = await h.api('GET', '/users/me', { cookie: browserCookies, headers: asPanel('CUSTOMER') });
      const asMaster = await h.api('GET', '/users/me', { cookie: browserCookies, headers: asPanel('MASTER') });
      expect(asCustomer.data.phone).toBe(customerPhone);
      expect(asMaster.data.phone).toBe(masterPhone);
    });

    it('a session of another panel (or of no panel) does not authenticate', async () => {
      const ip = '10.1.6.4';
      const phone = await registerAndActivate(ip);
      const login = await panelLogin(phone, 'MASTER', ip);
      const cookie = cookieHeader(login, ['accessToken_master']);
      expect((await h.api('GET', '/users/me', { cookie, headers: asPanel('MASTER') })).status).toBe(200);
      expect((await h.api('GET', '/users/me', { cookie, headers: asPanel('CUSTOMER') })).status).toBe(401);
      expect((await h.api('GET', '/users/me', { cookie, headers: asPanel('ADMIN') })).status).toBe(401);
      expect((await h.api('GET', '/users/me', { cookie })).status).toBe(401);
    });

    it('refresh and logout act on the calling panel only', async () => {
      const ip = '10.1.6.5';
      const phone = await registerAndActivate(ip);
      const customer = await panelLogin(phone, 'CUSTOMER', ip);
      const master = await panelLogin(phone, 'MASTER', ip);
      const customerCookies = cookieHeader(customer, ['accessToken_customer', 'refreshToken_customer', 'deviceId_customer']);
      const masterCookies = cookieHeader(master, ['accessToken_master', 'refreshToken_master', 'deviceId_master']);

      const refreshed = await h.api('POST', '/auth/refresh', { ip, cookie: masterCookies, headers: asPanel('MASTER'), body: {} });
      expect(refreshed.status).toBe(201);
      expect(refreshed.headers.getSetCookie().map((line) => line.split('=')[0])).toContain('accessToken_master');

      const wrongPanel = await h.api('POST', '/auth/refresh', { ip, cookie: customerCookies, headers: asPanel('MASTER'), body: {} });
      expect(wrongPanel.status).toBe(401);

      const out = await h.api('POST', '/auth/logout', { ip, cookie: customerCookies, headers: asPanel('CUSTOMER'), body: { allDevices: false } });
      expect(out.status).toBe(201);
      const cleared = out.headers.getSetCookie().map((line) => line.split('=')[0]);
      expect(cleared).toEqual(expect.arrayContaining(['accessToken_customer', 'refreshToken_customer', 'deviceId_customer']));
      expect(cleared).not.toContain('accessToken_master');

      expect((await h.api('GET', '/users/me', { cookie: customerCookies, headers: asPanel('CUSTOMER') })).status).toBe(401);
      expect((await h.api('GET', '/users/me', { cookie: cookieHeader(refreshed, ['accessToken_master']), headers: asPanel('MASTER') })).status).toBe(200);
    });
  });

  describe('there is no second factor besides the one-time code', () => {
    it('an admin signs in with password + OTP only, and the MFA endpoints and fields are gone', async () => {
      const ip = '10.1.5.1';
      const phone = uniquePhone();
      await h.db.user.create({
        data: { phone, status: 'ACTIVE', phoneVerifiedAt: new Date(), passwordHash: await bcrypt.hash(PASSWORD, 4), userRoles: { create: { role: 'ADMIN' } } },
      });
      const step1 = await h.api('POST', '/auth/login', { ip, body: { phone, password: PASSWORD } });
      expect(step1.status).toBe(201);
      await setOtp(phone, 'LOGIN', '654321');
      const done = await h.api('POST', '/auth/verify-otp', { ip, body: { phone, code: '654321' } });
      expect(done.status).toBe(201);
      const cookie = `accessToken=${cookiesOf(done.headers).accessToken}`;

      expect((await h.api('POST', '/auth/mfa/enroll', { cookie, body: {} })).status).toBe(404);
      expect((await h.api('POST', '/auth/mfa/verify-enrollment', { cookie, body: { code: '123456' } })).status).toBe(404);
      const withMfaField = await h.api('POST', '/auth/verify-otp', { ip, body: { phone, code: '654321', mfaCode: '123456' } });
      expect(withMfaField.status).toBe(400);
    });

    it('the user table no longer has MFA columns', async () => {
      const columns = await h.db.$queryRaw<Array<{ column_name: string }>>`SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`;
      expect(columns.map((column) => column.column_name)).not.toEqual(expect.arrayContaining(['mfa_secret']));
      expect(columns.map((column) => column.column_name)).not.toEqual(expect.arrayContaining(['mfa_enabled']));
    });
  });

  describe('active devices list', () => {
    const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
    const PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1';

    async function signIn(phone: string, ip: string, userAgent: string, panel: string) {
      const headers = { 'user-agent': userAgent, 'x-app-panel': panel };
      await h.db.otpCode.deleteMany({ where: { phone } });
      expect((await h.api('POST', '/auth/login', { ip, headers, body: { phone, password: PASSWORD } })).status).toBe(201);
      await setOtp(phone, 'LOGIN', '654321');
      const res = await h.api('POST', '/auth/verify-otp', { ip, headers, body: { phone, code: '654321' } });
      expect(res.status).toBe(201);
      const cookies = cookiesOf(res.headers);
      return { cookie: `accessToken_${panel.toLowerCase()}=${cookies[`accessToken_${panel.toLowerCase()}`]}`, panel };
    }
    type Session = Awaited<ReturnType<typeof signIn>>;
    const call = (method: string, path: string, session: Session, body?: unknown) =>
      h.api(method, path, { cookie: session.cookie, headers: { 'x-app-panel': session.panel }, body });
    const sessions = (session: Session) => call('GET', '/auth/sessions', session);
    const ageDevices = (phone: string, hours: number, deviceFilter: object = {}) =>
      h.db.deviceSession.updateMany({
        where: { user: { phone }, ...deviceFilter },
        data: { createdAt: new Date(Date.now() - hours * 3_600_000) },
      });

    it('lists only active devices with browser, IP and panel, marks the current one, never leaks device ids, and is scoped to the caller’s own panel', async () => {
      const ip = '10.1.4.1';
      const phone = await registerAndActivate(ip);
      const desktop = await signIn(phone, ip, CHROME, 'CUSTOMER');
      const mobile = await signIn(phone, ip, PHONE_UA, 'CUSTOMER');
      const masterApp = await signIn(phone, ip, PHONE_UA, 'MASTER');

      const list = await sessions(desktop);
      expect(list.status).toBe(200);
      // Faqat shu chaqiruvchi panel (CUSTOMER) qurilmalari ko‘rinadi — boshqa panel (MASTER) sizib chiqmaydi.
      expect(list.data).toHaveLength(2);
      for (const item of list.data) {
        expect(item).not.toHaveProperty('deviceId');
        expect(item.status).toBe('ACTIVE');
        expect(item.ipAddress).toBe(ip);
        expect(item.panel).toBe('CUSTOMER');
      }
      const current = list.data.filter((item: { isCurrent: boolean }) => item.isCurrent);
      expect(current).toHaveLength(1);
      expect(current[0]).toMatchObject({ userAgent: CHROME, panel: 'CUSTOMER' });
      expect(list.data.find((item: { isCurrent: boolean }) => !item.isCurrent)).toMatchObject({ userAgent: PHONE_UA, panel: 'CUSTOMER' });

      const fromMaster = await sessions(masterApp);
      expect(fromMaster.data).toHaveLength(1);
      expect(fromMaster.data[0]).toMatchObject({ isCurrent: true, panel: 'MASTER' });
    });

    it('signs one device out by its session id — that device loses access at once, the caller keeps it', async () => {
      const ip = '10.1.4.2';
      const phone = await registerAndActivate(ip);
      const a = await signIn(phone, ip, CHROME, 'CUSTOMER');
      const b = await signIn(phone, ip, PHONE_UA, 'CUSTOMER');
      const other = (await sessions(a)).data.find((item: { isCurrent: boolean }) => !item.isCurrent);
      await ageDevices(phone, 48);

      expect((await call('POST', `/auth/sessions/${other.id}/revoke`, a, {})).status).toBe(201);
      expect((await sessions(b)).status).toBe(401);
      const after = await sessions(a);
      expect(after.status).toBe(200);
      expect(after.data).toHaveLength(1);
      expect(after.data[0].isCurrent).toBe(true);
    });

    it('“sign out other devices” keeps only the current one', async () => {
      const ip = '10.1.4.3';
      const phone = await registerAndActivate(ip);
      const a = await signIn(phone, ip, CHROME, 'CUSTOMER');
      const b = await signIn(phone, ip, PHONE_UA, 'CUSTOMER');
      await ageDevices(phone, 48);
      const res = await call('POST', '/auth/sessions/revoke-others', a, {});
      expect(res.status).toBe(201);
      expect(res.data).toEqual({ revoked: 1 });
      expect((await sessions(b)).status).toBe(401);
      expect((await sessions(a)).data).toHaveLength(1);
    });

    it('a device connected less than 24 hours ago cannot sign out devices connected before it', async () => {
      const ip = '10.1.4.6';
      const phone = await registerAndActivate(ip);
      const first = await signIn(phone, ip, CHROME, 'CUSTOMER');
      const second = await signIn(phone, ip, PHONE_UA, 'CUSTOMER');
      const firstId = (await sessions(second)).data.find((item: { isCurrent: boolean }) => !item.isCurrent).id;

      const view = (await sessions(second)).data;
      expect(view.find((item: { isCurrent: boolean }) => !item.isCurrent)).toMatchObject({ canRevoke: false });
      expect(view.find((item: { revokeLockedUntil: string | null }) => item.revokeLockedUntil)).toBeTruthy();
      expect(view.find((item: { isCurrent: boolean }) => item.isCurrent)).toMatchObject({ canRevoke: true, revokeLockedUntil: null });

      expect((await call('POST', `/auth/sessions/${firstId}/revoke`, second, {})).status).toBe(403);
      expect((await call('POST', '/auth/sessions/revoke-others', second, {})).status).toBe(403);
      expect((await sessions(first)).status).toBe(200);

      const secondId = (await sessions(first)).data.find((item: { isCurrent: boolean }) => !item.isCurrent).id;
      expect((await call('POST', `/auth/sessions/${secondId}/revoke`, first, {})).status).toBe(201);
      expect((await sessions(second)).status).toBe(401);
    });

    it('after 24 hours the same device may sign out the older ones', async () => {
      const ip = '10.1.4.7';
      const phone = await registerAndActivate(ip);
      const first = await signIn(phone, ip, CHROME, 'CUSTOMER');
      const second = await signIn(phone, ip, PHONE_UA, 'CUSTOMER');
      await h.db.deviceSession.updateMany({ where: { user: { phone }, userAgent: PHONE_UA }, data: { createdAt: new Date(Date.now() - 25 * 3_600_000) } });
      await h.db.deviceSession.updateMany({ where: { user: { phone }, userAgent: CHROME }, data: { createdAt: new Date(Date.now() - 30 * 3_600_000) } });

      expect((await sessions(second)).data.every((item: { canRevoke: boolean }) => item.canRevoke)).toBe(true);
      expect((await call('POST', '/auth/sessions/revoke-others', second, {})).data).toEqual({ revoked: 1 });
      expect((await sessions(first)).status).toBe(401);
    });

    it('a user cannot see or revoke another account’s devices', async () => {
      const ip = '10.1.4.4';
      const alice = await registerAndActivate(ip);
      const bob = await registerAndActivate('10.1.4.5');
      const aliceCookie = await signIn(alice, ip, CHROME, 'CUSTOMER');
      const bobCookie = await signIn(bob, '10.1.4.5', CHROME, 'CUSTOMER');
      const aliceSessionId = (await sessions(aliceCookie)).data[0].id;

      expect((await call('POST', `/auth/sessions/${aliceSessionId}/revoke`, bobCookie, {})).status).toBe(400);
      expect((await sessions(aliceCookie)).status).toBe(200);
      expect((await sessions(bobCookie)).data).toHaveLength(1);
      expect((await h.api('GET', '/auth/sessions')).status).toBe(401);
    });
  });

  it('refresh rotates the token; replaying the old one revokes the whole family', async () => {
    const ip = '10.1.0.6';
    const phone = await registerAndActivate(ip);
    const c1 = cookiesOf((await login(phone, ip)).headers);
    const cookie1 = `refreshToken=${c1.refreshToken}; deviceId=${c1.deviceId}`;

    const rotated = await h.api('POST', '/auth/refresh', { ip, cookie: cookie1, body: {} });
    expect(rotated.status).toBe(201);
    const c2 = cookiesOf(rotated.headers);
    expect(c2.refreshToken).toBeTruthy();
    expect(c2.refreshToken).not.toBe(c1.refreshToken);

    const replay = await h.api('POST', '/auth/refresh', { ip, cookie: cookie1, body: {} });
    expect(replay.status).toBe(401);
    const afterReplay = await h.api('POST', '/auth/refresh', { ip, cookie: `refreshToken=${c2.refreshToken}; deviceId=${c2.deviceId}`, body: {} });
    expect(afterReplay.status).toBe(401);
  });

  it('accepts the refresh token in the body (non-browser clients) and rejects garbage', async () => {
    const ip = '10.1.0.7';
    const phone = await registerAndActivate(ip);
    const c = cookiesOf((await login(phone, ip)).headers);
    expect((await h.api('POST', '/auth/refresh', { ip, body: { refreshToken: 'a'.repeat(30) } })).status).toBe(401);
    expect((await h.api('POST', '/auth/refresh', { ip, body: { refreshToken: 'short' } })).status).toBe(400);
    const ok = await h.api('POST', '/auth/refresh', { ip, body: { refreshToken: c.refreshToken } });
    expect(ok.status).toBe(201);
  });

  it('caps concurrent devices at MAX_ACTIVE_DEVICES', async () => {
    const ip = '10.1.0.8';
    const phone = await registerAndActivate(ip);
    await login(phone, ip);
    await h.db.otpCode.deleteMany({ where: { phone } });
    await login(phone, ip);
    await h.db.otpCode.deleteMany({ where: { phone } });
    const third = await login(phone, ip);
    const user = await h.db.user.findUniqueOrThrow({ where: { phone } });
    const active = await h.db.deviceSession.count({ where: { userId: user.id, status: 'ACTIVE' } });
    expect(active).toBeLessThanOrEqual(2);
    expect([201, 403, 409]).toContain(third.status);
  });

  it('warns at the password step (before any code is entered) when the device limit is reached for a new device', async () => {
    const ip = '10.1.0.18';
    const phone = await registerAndActivate(ip);
    await login(phone, ip);
    await h.db.otpCode.deleteMany({ where: { phone } });
    const below = await h.api('POST', '/auth/login', { ip, body: { phone, password: PASSWORD } });
    expect(below.status).toBe(201);
    expect(below.data.deviceLimit).toBeUndefined();
    await h.db.otpCode.deleteMany({ where: { phone } });
    await login(phone, ip);
    await h.db.otpCode.deleteMany({ where: { phone } });
    const third = await h.api('POST', '/auth/login', { ip, body: { phone, password: PASSWORD } });
    expect(third.status).toBe(201);
    expect(third.data.deviceLimit).toMatchObject({ reached: true, max: 2 });
  });

  describe('failed-login lockout (10 wrong attempts in 10 minutes → 2 minutes)', () => {
    const wrong = (phone: string, ip: string) => h.api('POST', '/auth/login', { ip, body: { phone, password: 'Nope-Nope-1' } });
    const right = (phone: string, ip: string) => h.api('POST', '/auth/login', { ip, body: { phone, password: PASSWORD } });
    const redis = () => h.app.get(RedisService);

    it('allows 10 wrong attempts, then blocks the 11th — even with the correct password — for about 2 minutes', async () => {
      const ip = '10.1.1.1';
      const phone = await registerAndActivate(ip);
      for (let i = 0; i < 10; i += 1) expect((await wrong(phone, ip)).status, `attempt ${i + 1}`).toBe(401);

      const blocked = await right(phone, ip);
      expect(blocked.status).toBe(429);
      expect(blocked.body.code).toBe('LOGIN_LOCKED');
      const seconds = Number(/(\d+) soniya/.exec(blocked.body.message)?.[1]);
      expect(seconds).toBeGreaterThan(100);
      expect(seconds).toBeLessThanOrEqual(120);
      expect((await wrong(phone, ip)).status).toBe(429);
    });

    it('counts failures inside a 10-minute window (and locks for 2 minutes, not longer)', async () => {
      const ip = '10.1.1.9';
      const phone = await registerAndActivate(ip);
      await wrong(phone, ip);
      const windowTtl = await redis().ttl(`loginfail:${ip}:${phone}:any`);
      expect(windowTtl).toBeGreaterThan(590);
      expect(windowTtl).toBeLessThanOrEqual(600);
      for (let i = 0; i < 9; i += 1) await wrong(phone, ip);
      const lockTtl = await redis().ttl(`loginlock:${ip}:${phone}:any`);
      expect(lockTtl).toBeGreaterThan(110);
      expect(lockTtl).toBeLessThanOrEqual(120);
    });

    it('lets the user in again once the 2 minutes are over', async () => {
      const ip = '10.1.1.2';
      const phone = await registerAndActivate(ip);
      for (let i = 0; i < 10; i += 1) await wrong(phone, ip);
      expect((await right(phone, ip)).status).toBe(429);
      const ttl = await redis().ttl(`loginlock:${ip}:${phone}:any`);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(120);

      await redis().del(`loginlock:${ip}:${phone}:any`);
      expect((await right(phone, ip)).status).toBe(201);
    });

    it('does not lock out a different IP, and unknown phones are throttled exactly like real ones', async () => {
      const ip = '10.1.1.3';
      const phone = await registerAndActivate(ip);
      const ghost = uniquePhone();
      for (let i = 0; i < 10; i += 1) {
        await wrong(phone, ip);
        expect((await wrong(ghost, ip)).status).toBe(401);
      }
      expect((await wrong(ghost, ip)).status).toBe(429);
      expect((await right(phone, '10.1.1.4')).status).toBe(201);
    });

    it('a successful login resets the failure counter', async () => {
      const ip = '10.1.1.5';
      const phone = await registerAndActivate(ip);
      for (let i = 0; i < 9; i += 1) await wrong(phone, ip);
      expect((await right(phone, ip)).status).toBe(201);
      for (let i = 0; i < 9; i += 1) expect((await wrong(phone, ip)).status).toBe(401);
      await h.db.otpCode.deleteMany({ where: { phone } });
      expect((await right(phone, ip)).status).toBe(201);
    });
  });

  describe('limits are counted separately for every panel (customer / master / admin ports share one IP)', () => {
    const asPanel = (panel: string) => ({ 'x-app-panel': panel });

    it('registration limit (3 / hour / IP) is per panel', async () => {
      const ip = '10.1.2.1';
      const register = async (panel: string) =>
        (await h.api('POST', '/auth/register', { ip, headers: asPanel(panel), body: { phone: uniquePhone(), password: PASSWORD, firstName: 'Test', lastName: 'User', acceptedPolicyIds: await policyIds() } })).status;
      for (let i = 0; i < 3; i += 1) expect(await register('CUSTOMER')).toBe(201);
      expect(await register('CUSTOMER')).toBe(429);
      expect(await register('MASTER')).toBe(201);
      expect(await register('ADMIN')).toBe(201);
    });

    it('a customer-panel lockout does not lock the same person out of the master panel', async () => {
      const ip = '10.1.2.2';
      const phone = await registerAndActivate(ip);
      const attempt = (panel: string, password: string) => h.api('POST', '/auth/login', { ip, headers: asPanel(panel), body: { phone, password } });
      for (let i = 0; i < 10; i += 1) await attempt('CUSTOMER', 'Nope-Nope-1');
      expect((await attempt('CUSTOMER', PASSWORD)).status).toBe(429);
      expect((await attempt('MASTER', PASSWORD)).status).toBe(201);
    });

    it('the 60 s OTP resend cooldown and the hourly OTP cap are per panel', async () => {
      const ip = '10.1.2.3';
      const phone = await registerAndActivate(ip);
      const login = (panel: string) => h.api('POST', '/auth/login', { ip, headers: asPanel(panel), body: { phone, password: PASSWORD } });
      await h.db.otpCode.deleteMany({ where: { phone } });
      expect((await login('CUSTOMER')).status).toBe(201);
      expect((await login('CUSTOMER')).status).toBe(429);
      expect((await login('MASTER')).status).toBe(201);
      const rows = await h.db.otpCode.findMany({ where: { phone, purpose: 'LOGIN' }, select: { panel: true } });
      expect(rows.map((row) => row.panel).sort()).toEqual(['CUSTOMER', 'MASTER']);
    });

    it('an unknown panel value is not a way around the limits: it falls into the shared “no panel” bucket', async () => {
      const ip = '10.1.2.4';
      const register = async (panel?: string) =>
        (await h.api('POST', '/auth/register', { ip, headers: panel ? asPanel(panel) : {}, body: { phone: uniquePhone(), password: PASSWORD, firstName: 'Test', lastName: 'User', acceptedPolicyIds: await policyIds() } })).status;
      for (const panel of ['x1', 'x2', undefined]) expect(await register(panel)).toBe(201);
      expect(await register('x3')).toBe(429);
    });
  });

  it('rate-limits registration per IP (3 / hour)', async () => {
    const ip = '10.1.0.11';
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      statuses.push((await h.api('POST', '/auth/register', { ip, body: { phone: uniquePhone(), password: PASSWORD, firstName: 'Test', lastName: 'User', acceptedPolicyIds: await policyIds() } })).status);
    }
    expect(statuses.slice(0, 3).every((s) => s === 201)).toBe(true);
    expect(statuses[3]).toBe(429);
  });
});

describe('K03 — OTP', () => {
  it('never returns the code unless dev-echo is explicitly enabled', async () => {
    const phone = uniquePhone();
    const echoed = await h.api('POST', '/otp/request', { ip: '10.2.0.1', body: { phone } });
    expect(echoed.status).toBe(201);
    expect(echoed.data.developmentCode).toMatch(/^\d{6}$/);
    process.env.OTP_DEV_ECHO = 'false';
    try {
      const silent = await h.api('POST', '/otp/request', { ip: '10.2.0.2', body: { phone: uniquePhone() } });
      expect(silent.data).toEqual({ verificationRequired: true, expiresIn: 300, resendAfter: 60 });
    } finally {
      process.env.OTP_DEV_ECHO = 'true';
    }
  });

  it('stores only a bcrypt hash of the code', async () => {
    const phone = uniquePhone();
    const res = await h.api('POST', '/otp/request', { ip: '10.2.0.3', body: { phone } });
    const row = await h.db.otpCode.findFirstOrThrow({ where: { phone } });
    expect(row.codeHash).not.toContain(res.data.developmentCode);
    expect(await bcrypt.compare(res.data.developmentCode, row.codeHash)).toBe(true);
    expect(Math.abs(row.expiresAt.getTime() - row.createdAt.getTime() - 5 * 60_000)).toBeLessThan(2_000);
  });

  it('accepts the right code once; replay, wrong code and other purposes fail', async () => {
    const ip = '10.2.0.4';
    const phone = uniquePhone();
    const { data } = await h.api('POST', '/otp/request', { ip, body: { phone } });
    expect((await h.api('POST', '/otp/verify', { ip, body: { phone, code: data.developmentCode === '000000' ? '111111' : '000000' } })).status).toBe(400);
    expect((await h.api('POST', '/otp/verify', { ip, body: { phone, code: data.developmentCode } })).data).toEqual({ verified: true });
    expect((await h.api('POST', '/otp/verify', { ip, body: { phone, code: data.developmentCode } })).status).toBe(400);
    const user = uniquePhone();
    await h.api('POST', '/auth/register', { ip: '10.2.0.5', body: { phone: user, password: PASSWORD, firstName: 'Test', lastName: 'User', acceptedPolicyIds: await policyIds() } });
    const other = await h.api('POST', '/otp/request', { ip, body: { phone: user } });
    const cross = await h.api('POST', '/auth/verify-registration', { ip, body: { phone: user, code: other.data.developmentCode } });
    expect(cross.status).toBe(400);
  });

  it('expires after its TTL', async () => {
    const ip = '10.2.0.6';
    const phone = uniquePhone();
    const { data } = await h.api('POST', '/otp/request', { ip, body: { phone } });
    await h.db.otpCode.updateMany({ where: { phone }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await h.api('POST', '/otp/verify', { ip, body: { phone, code: data.developmentCode } })).status).toBe(400);
  });

  it('blocks a code after 5 wrong attempts — even the correct code is then refused', async () => {
    const ip = '10.2.0.7';
    const phone = uniquePhone();
    const { data } = await h.api('POST', '/otp/request', { ip, body: { phone } });
    const wrong = data.developmentCode === '000000' ? '111111' : '000000';
    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await h.api('POST', '/otp/verify', { ip, body: { phone, code: wrong } })).status);
    expect(statuses).toEqual([400, 400, 400, 400, 429]);
    expect((await h.api('POST', '/otp/verify', { ip, body: { phone, code: data.developmentCode } })).status).toBe(429); // raqam bazada bor-yo‘qligidan qat’i nazar bir xil: urinishlar tugagach to‘g‘ri kod ham rad etiladi
  });

  it('enforces the 60 s resend cooldown and the hourly cap', async () => {
    const phone = uniquePhone();
    expect((await h.api('POST', '/otp/request', { ip: '10.2.0.8', body: { phone } })).status).toBe(201);
    const early = await h.api('POST', '/otp/request', { ip: '10.2.0.9', body: { phone } });
    expect(early.status).toBe(429);
    expect(early.body.message).toMatch(/\d+ soniya kuting/);

    await h.db.otpCode.deleteMany({ where: { phone } });
    await h.db.otpCode.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        phone,
        codeHash: 'x',
        purpose: 'PHONE_VERIFICATION' as const,
        status: 'EXPIRED' as const,
        expiresAt: new Date(),
        createdAt: new Date(Date.now() - (10 + i) * 60_000),
      })),
    });
    const capped = await h.api('POST', '/otp/request', { ip: '10.2.0.10', body: { phone } });
    expect(capped.status).toBe(429);
    expect(capped.body.message).toMatch(/\d+ daqiqadan so‘ng/);
  });

  it('validates the code format', async () => {
    for (const code of ['12345', '1234567', 'abcdef', '']) {
      expect((await h.api('POST', '/otp/verify', { ip: '10.2.0.11', body: { phone: uniquePhone(), code } })).status).toBe(400);
    }
  });
});
