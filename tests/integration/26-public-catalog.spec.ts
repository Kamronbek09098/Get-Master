import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createMaster, firstService, type Harness, type TestMaster } from '../helpers/harness';

let h: Harness;
let master: TestMaster;

beforeAll(async () => {
  h = await bootHarness();
  master = await createMaster(h, (await firstService(h)).id);
});
afterAll(async () => {
  await h.close();
});

describe('public catalog and stats', () => {
  it('lists verified masters without logging in and never leaks contact data', async () => {
    const res = await h.api('GET', '/public/masters?limit=24');
    expect(res.status).toBe(200);
    expect(res.data.total).toBeGreaterThan(0);
    const raw = JSON.stringify(res.data);
    expect(raw).not.toMatch(/phone|email|latitude|longitude|passwordHash/i);
    for (const item of res.data.items) {
      expect(typeof item.id).toBe('number');
      expect(item.name.length).toBeGreaterThan(0);
      expect(Array.isArray(item.services)).toBe(true);
    }
  });

  it('filters by category and query; rejects malformed input', async () => {
    const service = await h.db.service.findFirstOrThrow({ where: { id: (await firstService(h)).id } });
    const filtered = await h.api('GET', `/public/masters?categoryId=${service.categoryId}&limit=24`);
    expect(filtered.status).toBe(200);
    expect(filtered.data.total).toBeGreaterThan(0);
    const none = await h.api('GET', '/public/masters?q=zzzz-yo-q-usta-qqq');
    expect(none.data.total).toBe(0);
    expect((await h.api('GET', '/public/masters?categoryId=nope')).status).toBe(400);
    expect((await h.api('GET', '/public/masters?limit=500')).status).toBe(400);
  });

  it('hides paused masters', async () => {
    await h.db.masterProfile.update({ where: { id: master.masterId }, data: { isPaused: true } });
    const { accountNumber } = await h.db.user.findUniqueOrThrow({ where: { id: master.id }, select: { accountNumber: true } });
    const all = await h.api('GET', '/public/masters?limit=24');
    expect(all.data.items.some((item: { id: number }) => item.id === accountNumber)).toBe(false);
    await h.db.masterProfile.update({ where: { id: master.masterId }, data: { isPaused: false } });
  });

  it('serves stats publicly', async () => {
    const res = await h.api('GET', '/public/stats');
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ masters: expect.any(Number), completedOrders: expect.any(Number), categories: expect.any(Number), services: expect.any(Number) });
  });

  it('shows subscription plans without logging in', async () => {
    const res = await h.api('GET', '/public/plans');
    expect(res.status).toBe(200);
    expect(res.data.plans.map((plan: { code: string }) => plan.code)).toEqual(['CUSTOMER_PLUS', 'MASTER_PRO']);
  });

  it('lists service prices per category with master counts', async () => {
    const res = await h.api('GET', '/public/prices');
    expect(res.status).toBe(200);
    expect(res.data.length).toBeGreaterThan(0);
    for (const category of res.data) {
      expect(category.services.length).toBeGreaterThan(0);
      expect(category.masters).toBeGreaterThan(0);
      for (const service of category.services) {
        expect(service.minPrice === null || typeof service.minPrice === 'number').toBe(true);
        expect(service.masters).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
