import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createAdmin, createSuperAdmin, createUser, type Harness, type TestUser } from '../helpers/harness';

let h: Harness;
let superAdmin: TestUser;
let plain: TestUser;
let customer: TestUser;
let fp: string;

beforeAll(async () => {
  h = await bootHarness();
  superAdmin = await createSuperAdmin(h);
  plain = await createAdmin(h);
  customer = await createUser(h, ['CUSTOMER']);
  fp = 'a'.repeat(40);
  const base = { source: 'SERVER', kind: 'HTTP', fingerprint: fp, path: '/api/v1/payments', method: 'POST', message: 'Validation failed', status: 400, code: 'BAD_REQUEST', severity: 'WARNING' };
  await h.db.errorLog.createMany({
    data: [
      { ...base, userId: customer.id, ipAddress: '10.0.0.1', stack: 'Error: x\n  at y' },
      { ...base, userId: customer.id },
      { ...base, userId: null },
      { source: 'SERVER', kind: 'HTTP', fingerprint: 'b'.repeat(40), path: '/api/v1/orders', method: 'GET', message: 'boom', status: 500, code: 'INTERNAL', severity: 'ERROR' },
      { source: 'CLIENT', kind: 'UI_CRASH', fingerprint: 'c'.repeat(40), message: 'ui crash', severity: 'ERROR', pageUrl: '/mijoz' },
    ],
  });
});
afterAll(async () => {
  await h.close();
});

describe('admin errors page API', () => {
  it('is superadmin-only and validates filters', async () => {
    for (const path of ['/admin/errors/overview', '/admin/errors/groups/page', `/admin/errors/groups/${fp}`]) expect((await h.get(path, plain.token)).status, path).toBe(403);
    expect((await h.get('/admin/errors/groups/page?severity=BAD', superAdmin.token)).status).toBe(400);
    expect((await h.get('/admin/errors/groups/not-a-fingerprint', superAdmin.token)).status).toBe(400);
    expect((await h.get(`/admin/errors/groups/${'d'.repeat(40)}`, superAdmin.token)).status).toBe(404);
  });

  it('overview counts, categories and daily series agree with the data', async () => {
    const res = await h.get('/admin/errors/overview', superAdmin.token);
    expect(res.status).toBe(200);
    const { current, previous, categories, series, codes } = res.data;
    expect(current.total).toBeGreaterThanOrEqual(5);
    expect(current.severe).toBeGreaterThanOrEqual(2);
    expect(current.affectedUsers).toBeGreaterThanOrEqual(1);
    expect(previous.total).toBeGreaterThanOrEqual(0);
    expect(categories.client4xx).toBeGreaterThanOrEqual(3);
    expect(categories.server5xx).toBeGreaterThanOrEqual(1);
    expect(categories.ui).toBeGreaterThanOrEqual(1);
    expect(series.reduce((sum: number, row: { errors: number; warnings: number }) => sum + row.errors + row.warnings, 0)).toBe(current.total);
    expect(codes.map((c: { status: number }) => c.status)).toEqual(expect.arrayContaining([400, 500]));
  });

  it('groups page filters, sorts and resolves', async () => {
    const all = await h.get('/admin/errors/groups/page?limit=100', superAdmin.token);
    const group = all.data.items.find((g: { fingerprint: string }) => g.fingerprint === fp);
    expect(group).toEqual(expect.objectContaining({ count: 3, users: 1, openCount: 3, resolved: false, status: 400 }));
    const severe = await h.get('/admin/errors/groups/page?limit=100&severity=ERROR', superAdmin.token);
    expect(severe.data.items.every((g: { severity: string }) => g.severity === 'ERROR')).toBe(true);
    const byClass = await h.get('/admin/errors/groups/page?limit=100&statusClass=5xx', superAdmin.token);
    expect(byClass.data.items.every((g: { status: number }) => g.status >= 500)).toBe(true);
    const search = await h.get('/admin/errors/groups/page?limit=100&q=payments', superAdmin.token);
    expect(search.data.items.map((g: { fingerprint: string }) => g.fingerprint)).toContain(fp);
    const byCount = await h.get('/admin/errors/groups/page?limit=100&sort=count&dir=desc', superAdmin.token);
    const counts = byCount.data.items.map((g: { count: number }) => g.count);
    expect(counts).toEqual([...counts].sort((a: number, b: number) => b - a));
    expect(all.data.pages).toBe(Math.max(1, Math.ceil(all.data.total / 100)));

    const detail = await h.get(`/admin/errors/groups/${fp}`, superAdmin.token);
    expect(detail.data).toEqual(expect.objectContaining({ count: 3, users: 1, openCount: 3, resolved: false }));
    expect(detail.data.sample.stack).toBeTruthy();
    expect(detail.data.topUsers[0].count).toBe(2);
    expect(detail.data.recent.length).toBe(3);

    expect((await h.post('/admin/errors/resolve', superAdmin.token, { fingerprint: fp, value: true })).data.updated).toBe(3);
    const resolved = await h.get('/admin/errors/groups/page?limit=100&state=resolved', superAdmin.token);
    expect(resolved.data.items.map((g: { fingerprint: string }) => g.fingerprint)).toContain(fp);
    expect((await h.get(`/admin/errors/groups/${fp}`, superAdmin.token)).data.resolved).toBe(true);
    const open = await h.get('/admin/errors/groups/page?limit=100&state=open', superAdmin.token);
    expect(open.data.items.map((g: { fingerprint: string }) => g.fingerprint)).not.toContain(fp);
  });
});
