import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { bootHarness, createAdmin, createUser, type Harness } from '../helpers/harness';

let h: Harness;
const realFetch = globalThis.fetch;
const clientId = process.env.GOOGLE_CLIENT_ID || 'test-client.apps.googleusercontent.com';

/** Google tokeninfo javobini soxtalashtiradi: credential «sub:email» ko‘rinishida. */
function stubGoogle() {
  process.env.GOOGLE_CLIENT_ID = clientId;
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    // Access token oqimi: token «at:sub:email:telefon|-» ko‘rinishida.
    const bearer = String((init?.headers as Record<string, string> | undefined)?.Authorization ?? '').replace('Bearer ', '');
    if (url.startsWith('https://oauth2.googleapis.com/tokeninfo?access_token=')) {
      return Promise.resolve(new Response(JSON.stringify({ aud: clientId }), { status: 200 }));
    }
    if (url.startsWith('https://openidconnect.googleapis.com/v1/userinfo')) {
      const [, gsub, gemail] = bearer.split(':');
      return Promise.resolve(new Response(JSON.stringify({ sub: gsub, email: gemail, email_verified: true, given_name: 'Gia', family_name: 'Test', picture: 'https://example.com/a.png' }), { status: 200 }));
    }
    if (url.startsWith('https://people.googleapis.com/v1/people/me')) {
      const gphone = bearer.split(':')[3];
      const body = gphone && gphone !== '-' ? { phoneNumbers: [{ canonicalForm: gphone, metadata: { verified: !gphone.endsWith('!') } }] } : {};
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }
    if (!url.startsWith('https://oauth2.googleapis.com/tokeninfo')) return realFetch(input, init);
    const credential = decodeURIComponent(url.split('id_token=')[1] ?? '');
    const [sub, email] = credential.split(':');
    if (!sub || !email) return Promise.resolve(new Response('{}', { status: 400 }));
    return Promise.resolve(new Response(JSON.stringify({ aud: clientId, sub, email, email_verified: 'true', iss: 'https://accounts.google.com', exp: String(Math.floor(Date.now() / 1000) + 600), given_name: 'Gia', family_name: 'Test' }), { status: 200 }));
  });
}

beforeAll(async () => {
  stubGoogle();
  h = await bootHarness();
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await h.close();
});

const sub = () => `g${Math.random().toString(36).slice(2, 12)}`;

describe('Google account linking', () => {
  it('links to a phone account, then signs in to the same account with Google (data kept)', async () => {
    const user = await createUser(h);
    const id = sub();
    const credential = `${id}:${id}@example.com`;
    const link = await h.post('/auth/google/link', user.token, { credential });
    expect(link.status).toBe(201);
    const me = await h.get('/users/me', user.token);
    expect(me.data).toMatchObject({ googleLinked: true, googleEmail: `${id}@example.com` });
    expect(JSON.stringify(me.body)).not.toContain('"googleId"');

    const login = await h.post('/auth/google', undefined, { credential });
    expect(login.status).toBe(201);
    expect(login.data).toMatchObject({ needsPhone: false, verificationRequired: false });
    const cookies = login.headers.getSetCookie().join(';');
    expect(cookies).toMatch(/access/i);
    const row = await h.db.user.findUniqueOrThrow({ where: { googleId: id } });
    expect(row.id).toBe(user.id);
  });

  it('one Google account cannot be linked to two accounts', async () => {
    const a = await createUser(h);
    const b = await createUser(h);
    const credential = `${sub()}:shared@example.com`;
    expect((await h.post('/auth/google/link', a.token, { credential })).status).toBe(201);
    expect((await h.post('/auth/google/link', b.token, { credential })).status).toBe(409);
  });

  it('linking requires a session and a valid Google token; admins cannot link', async () => {
    const user = await createUser(h);
    expect((await h.post('/auth/google/link', undefined, { credential: 'x:y@z.com' })).status).toBe(401);
    expect((await h.post('/auth/google/link', user.token, { credential: 'broken' })).status).toBe(401);
    const admin = await createAdmin(h);
    expect((await h.post('/auth/google/link', admin.token, { credential: `${sub()}:a@b.com` })).status).toBe(403);
  });

  it('unlinking works for accounts with a password and stops Google sign-in', async () => {
    const user = await createUser(h);
    const credential = `${sub()}:u@example.com`;
    await h.post('/auth/google/link', user.token, { credential });
    await h.db.user.update({ where: { id: user.id }, data: { passwordHash: null } });
    const noPassword = await h.post('/auth/google/unlink', user.token, {});
    expect(noPassword.status).toBe(400);
    await h.db.user.update({ where: { id: user.id }, data: { passwordHash: '$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123' } });
    expect((await h.post('/auth/google/unlink', user.token, {})).status).toBe(201);
    expect((await h.get('/users/me', user.token)).data.googleLinked).toBe(false);
    // Google endi bu akkauntga bog‘liq emas: shu Google bilan kirilsa, alohida yangi akkaunt ochiladi.
    const again = await h.post('/auth/google', undefined, { credential });
    expect(again.status).toBe(201);
    const fresh = await h.db.user.findFirstOrThrow({ where: { googleEmail: 'u@example.com' }, orderBy: { createdAt: 'desc' } });
    expect(fresh.id).not.toBe(user.id);
  });

  it('a new Google user gets an active session at once with no questions; phone is optional', async () => {
    const credential = `${sub()}:new@example.com`;
    const first = await h.post('/auth/google', undefined, { credential });
    expect(first.status).toBe(201);
    expect(first.data).toMatchObject({ needsPhone: false, verificationRequired: false });
    const row = await h.db.user.findFirstOrThrow({ where: { googleEmail: 'new@example.com' }, orderBy: { createdAt: 'desc' } });
    expect(row).toMatchObject({ status: 'ACTIVE', firstName: 'Gia', lastName: 'Test', phone: null, phoneVerifiedAt: null });
  });

  it('a phoneless Google account cannot create requests until it verifies a phone', async () => {
    const first = await h.post('/auth/google', undefined, { credential: `${sub()}:nophone@example.com` });
    const token = first.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    const authed = (path: string, body?: unknown, method = 'POST') => h.api(method, path, { cookie: token, body });
    const blocked = await authed('/problem-requests', { title: 'Kran oqyapti', description: 'Oshxonadagi kran suv oqizyapti', latitude: 41.3, longitude: 69.2 });
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toMatch(/telefon raqamingizni kiriting va tasdiqlang/);

    const phone = `+99890${Math.floor(1000000 + Math.random() * 8999999)}`;
    const requested = await authed('/users/me/phone/request', { phone });
    expect(requested.status).toBe(201);
    const code = requested.data.developmentCode as string | undefined;
    if (code) {
      expect((await authed('/users/me/phone/verify', { phone, code: '000000' })).status).toBe(400);
      const ok = await authed('/users/me/phone/verify', { phone, code });
      expect(ok.status).toBe(201);
      expect(ok.data).toMatchObject({ phone });
      expect(ok.data.phoneVerifiedAt).toBeTruthy();
    }
  });
});

describe('Google access-token sign-in (profile + phone in one step)', () => {
  it('saves the Google phone as a verified number and signs in at once', async () => {
    const id = sub();
    const phone = `+99890${Math.floor(1000000 + Math.random() * 8999999)}`;
    const res = await h.post('/auth/google', undefined, { accessToken: `at:${id}:${id}@example.com:${phone}` });
    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({ needsPhone: false });
    const row = await h.db.user.findUniqueOrThrow({ where: { googleId: id } });
    expect(row).toMatchObject({ phone, status: 'ACTIVE', firstName: 'Gia', lastName: 'Test', email: `${id}@example.com` });
    expect(row.phoneVerifiedAt).not.toBeNull();
  });

  it('opens the account without a phone when Google has none or it is taken', async () => {
    const a = sub();
    const none = await h.post('/auth/google', undefined, { accessToken: `at:${a}:${a}@example.com:-` });
    expect(none.status).toBe(201);
    expect((await h.db.user.findUniqueOrThrow({ where: { googleId: a } })).phone).toBeNull();

    const taken = await createUser(h);
    const b = sub();
    const dup = await h.post('/auth/google', undefined, { accessToken: `at:${b}:${b}@example.com:${taken.phone}` });
    expect(dup.status).toBe(201);
    expect((await h.db.user.findUniqueOrThrow({ where: { googleId: b } })).phone).toBeNull();
  });
});

describe('password for Google-only accounts', () => {
  it('a Google-only account must set a password before it can unlink Google', async () => {
    const credential = `${sub()}:only@example.com`;
    const first = await h.post('/auth/google', undefined, { credential });
    const phone = `+99890${Math.floor(1000000 + Math.random() * 8999999)}`;
    const reg = first;
    await h.db.user.updateMany({ where: { googleEmail: 'only@example.com' }, data: { phone, phoneVerifiedAt: new Date() } });
    const token = reg.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    const authed = (path: string, body?: unknown, method = 'POST') => h.api(method, path, { cookie: token, body });

    const me = await authed('/users/me', undefined, 'GET');
    expect(me.data).toMatchObject({ googleLinked: true, hasPassword: false });
    const blocked = await authed('/auth/google/unlink', {});
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toMatch(/parol o‘rnatishingiz kerak/);

    expect((await authed('/users/me/password', { password: 'short' })).status).toBe(400);
    expect((await authed('/users/me/password', { password: 'Strong-Pass-123' })).status).toBe(201);
    expect((await authed('/users/me/password', { password: 'Another-Pass-123' })).status).toBe(409);
    expect((await authed('/users/me', undefined, 'GET')).data.hasPassword).toBe(true);

    expect((await authed('/auth/google/unlink', {})).status).toBe(201);
    const login = await h.post('/auth/login', undefined, { phone, password: 'Strong-Pass-123' });
    expect(login.status).toBe(201);
  });
});
