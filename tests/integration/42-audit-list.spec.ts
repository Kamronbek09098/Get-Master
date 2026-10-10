import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createAdmin, createSuperAdmin, createUser, type Harness, type TestUser } from '../helpers/harness';

let h: Harness;
let superAdmin: TestUser;
let noAudit: TestUser;
let customer: TestUser;

beforeAll(async () => {
  h = await bootHarness();
  superAdmin = await createSuperAdmin(h);
  noAudit = await createAdmin(h, ['USERS']);
  customer = await createUser(h, ['CUSTOMER']);
  await h.db.auditLog.createMany({
    data: [
      { actorId: superAdmin.id, action: 'ADMIN_USER_SUSPENDED', targetType: 'User', targetId: customer.id, reason: 'Test sababi', ipAddress: '10.9.9.9' },
      { actorId: customer.id, action: 'AUTH_LOGIN_COMPLETED', targetType: 'DeviceSession', ipAddress: '10.8.8.8', device: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/118 Safari/537' },
      { actorId: null, action: 'PAYMENT_WEBHOOK_MISMATCH', targetType: 'Payment', reason: 'summa mos kelmadi' },
      { actorId: customer.id, action: 'AUTH_REFRESH_ROTATED', targetType: 'DeviceSession' },
    ],
  });
});
afterAll(async () => {
  await h.close();
});

describe('audit log list', () => {
  it('is permission-gated and validates filters', async () => {
    expect((await h.get('/audit-logs?page=1', noAudit.token)).status).toBe(403);
    expect((await h.get('/audit-logs/stats', noAudit.token)).status).toBe(403);
    expect((await h.get('/audit-logs?outcome=MAYBE', superAdmin.token)).status).toBe(400);
    expect((await h.get('/audit-logs?actorRole=GOD', superAdmin.token)).status).toBe(400);
  });

  it('hides technical refresh entries by default, classifies outcomes and pages by number', async () => {
    const all = await h.get('/audit-logs?page=1&limit=100', superAdmin.token);
    expect(all.data.items.some((l: { action: string }) => l.action === 'AUTH_REFRESH_ROTATED')).toBe(false);
    expect(all.data.pages).toBeGreaterThanOrEqual(1);
    const withTech = await h.get('/audit-logs?page=1&limit=100&technical=true', superAdmin.token);
    expect(withTech.data.total).toBeGreaterThan(all.data.total);
    const failed = await h.get('/audit-logs?page=1&limit=100&outcome=FAILED', superAdmin.token);
    expect(failed.data.items.map((l: { action: string }) => l.action)).toContain('PAYMENT_WEBHOOK_MISMATCH');
    expect(failed.data.items.every((l: { outcome: string }) => l.outcome === 'FAILED')).toBe(true);
    const ok = await h.get('/audit-logs?page=1&limit=100&outcome=SUCCESS', superAdmin.token);
    expect(ok.data.items.some((l: { action: string }) => l.action === 'PAYMENT_WEBHOOK_MISMATCH')).toBe(false);
    expect(all.data.items[0]).toEqual(expect.objectContaining({ code: expect.stringMatching(/^AUD-[0-9A-F]{8}$/), actorRole: expect.any(String) }));
    const asc = await h.get('/audit-logs?page=1&limit=100&dir=asc', superAdmin.token);
    const times = asc.data.items.map((l: { createdAt: string }) => Date.parse(l.createdAt));
    expect(times).toEqual([...times].sort((a: number, b: number) => a - b));
  });

  it('filters by role/security/search and stats agree with the list', async () => {
    const security = await h.get('/audit-logs?page=1&limit=100&kind=security', superAdmin.token);
    expect(security.data.items.map((l: { action: string }) => l.action)).toContain('ADMIN_USER_SUSPENDED');
    expect(security.data.items.some((l: { action: string }) => l.action === 'AUTH_LOGIN_COMPLETED')).toBe(false);
    const byIp = await h.get('/audit-logs?page=1&limit=10&search=10.8.8.8', superAdmin.token);
    expect(byIp.data.items.map((l: { action: string }) => l.action)).toEqual(['AUTH_LOGIN_COMPLETED']);
    const byPhone = await h.get(`/audit-logs?page=1&limit=100&search=${customer.phone.slice(-9)}`, superAdmin.token);
    expect(byPhone.data.items.length).toBeGreaterThanOrEqual(1);
    const users = await h.get('/audit-logs?page=1&limit=1&actorRole=USERS', superAdmin.token);
    const stats = await h.get('/audit-logs/stats', superAdmin.token);
    expect(stats.data.current.users).toBe(users.data.total);
    const sec = await h.get('/audit-logs?page=1&limit=1&kind=security', superAdmin.token);
    expect(stats.data.current.security).toBe(sec.data.total);
    expect(stats.data.previous).toBeNull();
    const ranged = await h.get(`/audit-logs/stats?from=${new Date(Date.now() - 86_400_000).toISOString()}&to=${new Date().toISOString()}`, superAdmin.token);
    expect(ranged.data.previous).not.toBeNull();
  });

  it('returns related entries for a log', async () => {
    const target = await h.get('/audit-logs?page=1&limit=100&kind=security', superAdmin.token);
    const entry = target.data.items.find((l: { action: string }) => l.action === 'ADMIN_USER_SUSPENDED');
    const related = await h.get(`/audit-logs/${entry.id}/related`, superAdmin.token);
    expect(related.status).toBe(200);
    expect(related.data.items.every((l: { id: string }) => l.id !== entry.id)).toBe(true);
    expect((await h.get('/audit-logs/11111111-1111-4111-8111-111111111111/related', superAdmin.token)).status).toBe(404);
  });
});
