import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createAdmin, createSuperAdmin, type Harness, type TestUser } from '../helpers/harness';

let h: Harness;
let superAdmin: TestUser;
let noDevops: TestUser;

beforeAll(async () => {
  h = await bootHarness();
  superAdmin = await createSuperAdmin(h);
  noDevops = await createAdmin(h, ['USERS']);
});
afterAll(async () => {
  await h.close();
});

describe('GET /admin/devops', () => {
  it('needs the DEVOPS permission and rejects unknown windows', async () => {
    expect((await h.get('/admin/devops', noDevops.token)).status).toBe(403);
    expect((await h.get('/admin/devops?window=1y', superAdmin.token)).status).toBe(400);
  });

  it.each(['1h', '24h', '7d', '30d'])('returns the full monitoring snapshot for %s', async (window) => {
    await h.get('/admin/users', superAdmin.token); // trafikka kamida bitta so‘rov qo‘shadi
    const res = await h.get(`/admin/devops?window=${window}`, superAdmin.token);
    expect(res.status).toBe(200);
    const d = res.data;
    expect(d.system.cpuPercent).toBeGreaterThanOrEqual(0);
    expect(d.system.usedMemPercent).toBeLessThanOrEqual(100);
    expect(d.process.heapLimitMB).toBeGreaterThan(d.process.heapUsedMB);
    expect(d.traffic.length).toBe(window === '1h' ? 60 : window === '24h' ? 24 : window === '7d' ? 168 : 120);
    expect(d.traffic[0]).toEqual(expect.objectContaining({ count: expect.any(Number), errors: expect.any(Number) }));
    expect(d.trafficSummary.requests).toBe(d.traffic.reduce((sum: number, point: { count: number }) => sum + point.count, 0));
    expect(d.errors.series.length).toBeGreaterThan(0);
    expect(d.errors.last24h).toBeLessThanOrEqual(d.errors.logged24h);
    expect(d.backup.keepDaily).toBeGreaterThan(0);
    expect(Array.isArray(d.history)).toBe(true);
    expect(d.topEndpoints.every((item: { route: string }) => item.route.startsWith('/api/') && item.route !== '/api/health')).toBe(true);
  });
});
