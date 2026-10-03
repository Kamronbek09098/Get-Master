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
    const again = await h.post('/auth/google', undefined, { credential });
    expect(again.data.needsPhone).toBe(true);
  });

  it('a new Google user registers with a phone and gets an active session with no OTP', async () => {
    const credential = `${sub()}:new@example.com`;
    const first = await h.post('/auth/google', undefined, { credential });
    expect(first.data.needsPhone).toBe(true);
    const policies = await h.get('/legal/policies');
    const ids = (policies.data as Array<{ id: string; type: string }>).filter((p) => ['TERMS', 'PRIVACY', 'PLATFORM_RULES'].includes(p.type)).map((p) => p.id);
    const phone = `+99890${Math.floor(1000000 + Math.random() * 8999999)}`;
    const reg = await h.post('/auth/google/register', undefined, { signupToken: first.data.signupToken, phone, acceptedPolicyIds: ids });
    expect(reg.status).toBe(201);
    expect(reg.data.verificationRequired).toBe(false);
    const row = await h.db.user.findUniqueOrThrow({ where: { phone } });
    expect(row).toMatchObject({ status: 'ACTIVE', firstName: 'Gia', lastName: 'Test' });
  });
});

describe('password for Google-only accounts', () => {
  it('a Google-only account must set a password before it can unlink Google', async () => {
    const credential = `${sub()}:only@example.com`;
    const first = await h.post('/auth/google', undefined, { credential });
    const policies = await h.get('/legal/policies');
    const ids = (policies.data as Array<{ id: string; type: string }>).filter((p) => ['TERMS', 'PRIVACY', 'PLATFORM_RULES'].includes(p.type)).map((p) => p.id);
    const phone = `+99890${Math.floor(1000000 + Math.random() * 8999999)}`;
    const reg = await h.post('/auth/google/register', undefined, { signupToken: first.data.signupToken, phone, acceptedPolicyIds: ids });
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
