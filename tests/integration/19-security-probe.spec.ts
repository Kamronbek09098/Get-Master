import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { bootHarness, bookOrder, createMaster, createUser, firstService, openRequest, type Harness, type TestMaster, type TestUser } from '../helpers/harness';

let h: Harness;
let alice: TestUser;
let mallory: TestUser;
let master: TestMaster;
let orderId: string;
let requestId: string;

beforeAll(async () => {
  h = await bootHarness();
  alice = await createUser(h);
  mallory = await createUser(h);
  const service = await firstService(h);
  master = await createMaster(h, service.id);
  const booked = await bookOrder(h, alice, master, service.id);
  orderId = booked.orderId;
  requestId = booked.requestId;
});
afterAll(async () => {
  await h.close();
});

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('security probe: token forgery', () => {
  it('rejects alg=none, edited payloads, foreign signatures and garbage', async () => {
    const [head, payload, sig] = alice.token.split('.') as [string, string, string];
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const elevated = b64({ ...claims, roles: ['ADMIN'] });
    const forged = [
      `${b64({ alg: 'none', typ: 'JWT' })}.${payload}.`,
      `${b64({ alg: 'none', typ: 'JWT' })}.${elevated}.`,
      `${head}.${elevated}.${sig}`,
      `${head}.${elevated}.${createHmac('sha256', 'x'.repeat(40)).update(`${head}.${elevated}`).digest('base64url')}`,
      'a.b.c',
      '',
      `${head}.${payload}.${sig}x`,
    ];
    for (const token of forged) {
      const res = await h.get('/admin/users', token || undefined);
      expect([401, 403]).toContain(res.status);
    }
  });

  it('a customer token cannot reach admin or master endpoints', async () => {
    for (const path of ['/admin/users', '/admin/admins', '/admin/audit-logs', '/admin/dashboard']) {
      expect([401, 403, 404]).toContain((await h.get(path, alice.token)).status);
    }
    expect((await h.get('/admin/admins', alice.token)).status).toBe(403);
  });
});

describe('security probe: object-level authorisation (IDOR)', () => {
  it('another customer cannot read or change someone else’s request or order', async () => {
    const before = await h.db.problemRequest.findUniqueOrThrow({ where: { id: requestId }, select: { title: true, status: true } });
    expect([403, 404]).toContain((await h.get(`/problem-requests/${requestId}`, mallory.token)).status);
    const patched = await h.patch(`/problem-requests/${requestId}`, mallory.token, { title: 'hacked title' });
    expect(patched.status).toBeGreaterThanOrEqual(400);
    const cancelled = await h.post(`/problem-requests/${requestId}/cancel`, mallory.token, {});
    expect(cancelled.status).toBeGreaterThanOrEqual(400);
    const after = await h.db.problemRequest.findUniqueOrThrow({ where: { id: requestId }, select: { title: true, status: true } });
    expect(after).toEqual(before);
    for (const path of [`/orders/${orderId}`, `/orders/${orderId}/timeline`, `/orders/${orderId}/work-proofs`]) {
      const res = await h.get(path, mallory.token);
      expect([403, 404]).toContain(res.status);
    }
    for (const action of ['cancel', 'confirm-completion', 'dispute']) {
      const res = await h.post(`/orders/${orderId}/${action}`, mallory.token, { reason: 'x', description: 'x'.repeat(30) });
      expect([400, 403, 404]).toContain(res.status);
    }
    const mine = await h.get(`/orders/${orderId}`, alice.token);
    expect(mine.status).toBe(200);
  });

  it('the list endpoints only return the caller’s own rows', async () => {
    const list = await h.get('/orders', mallory.token);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(orderId);
    const reqs = await h.get('/problem-requests', mallory.token);
    expect(JSON.stringify(reqs.body)).not.toContain(requestId);
  });

  it('a customer cannot act as the master of an order', async () => {
    for (const action of ['start-travel', 'arrive', 'start-work', 'submit-completion']) {
      const res = await h.post(`/orders/${orderId}/${action}`, alice.token, {});
      expect([403, 404]).toContain(res.status);
    }
  });
});

describe('security probe: mass assignment & injection', () => {
  it('rejects unknown/privileged fields in registration and profile updates', async () => {
    const phone = `+99890${Math.floor(1000000 + Math.random() * 8999999)}`;
    const reg = await h.post('/auth/register', undefined, {
      phone, password: 'Strong-Pass-123', firstName: 'A', lastName: 'B', roles: ['ADMIN'], isSuperAdmin: true, status: 'ACTIVE', acceptedPolicyIds: [],
    });
    expect(reg.status).toBe(400);
    const patch = await h.patch('/users/me/name', alice.token, { firstName: 'Ok', lastName: 'Ok', roles: ['ADMIN'], isSuperAdmin: true });
    expect(patch.status).toBe(400);
    const row = await h.db.user.findUniqueOrThrow({ where: { id: alice.id }, select: { isSuperAdmin: true } });
    expect(row.isSuperAdmin).toBe(false);
  });

  it('SQL / NoSQL / path payloads never produce a 500', async () => {
    const evil = ["' OR 1=1 --", '"; DROP TABLE users; --', '{"$ne":null}', '../../etc/passwd', '%00', '<script>alert(1)</script>'];
    for (const value of evil) {
      for (const path of [`/services?search=${encodeURIComponent(value)}`, `/orders?status=${encodeURIComponent(value)}`, `/problem-requests/${encodeURIComponent(value)}`]) {
        const res = await h.get(path, alice.token);
        expect(res.status).toBeLessThan(500);
      }
      const login = await h.post('/auth/login', undefined, { phone: value, password: value });
      expect(login.status).toBeLessThan(500);
    }
  });

  it('Google endpoints reject forged credentials and unknown signup tokens', async () => {
    expect((await h.post('/auth/google', undefined, { credential: 'forged.token.value' })).status).toBeGreaterThanOrEqual(400);
    const reg = await h.post('/auth/google/register', undefined, { signupToken: 'nope', phone: '+998901112233', acceptedPolicyIds: [] });
    expect(reg.status).toBe(400);
  });
});

describe('security probe: hardening headers & info leaks', () => {
  it('sends security headers and hides stack traces / server details', async () => {
    const res = await h.api('GET', '/orders/not-a-uuid', { token: alice.token });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-powered-by')).toBeNull();
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(JSON.stringify(res.body)).not.toMatch(/node_modules|\.ts:\d+|prisma|SELECT /i);
  });

  it('does not reflect arbitrary CORS origins', async () => {
    const res = await h.api('GET', '/services', { headers: { origin: 'https://evil.example' } });
    expect(res.headers.get('access-control-allow-origin')).not.toBe('https://evil.example');
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
  });

  it('password hashes and tokens never appear in /users/me', async () => {
    const me = await h.get('/users/me', alice.token);
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|\$2[aby]\$|refreshToken/);
  });
});
