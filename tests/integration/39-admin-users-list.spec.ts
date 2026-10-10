import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createAdmin, createSuperAdmin, createUser, type Harness, type TestUser } from '../helpers/harness';

let h: Harness;
let superAdmin: TestUser;
let limited: TestUser;
let customers: TestUser[];
let master: TestUser;

beforeAll(async () => {
  h = await bootHarness();
  superAdmin = await createSuperAdmin(h);
  limited = await createAdmin(h, ['ORDERS']);
  customers = await Promise.all([createUser(h, ['CUSTOMER']), createUser(h, ['CUSTOMER']), createUser(h, ['CUSTOMER'])]);
  master = await createUser(h, ['CUSTOMER', 'MASTER']);
});
afterAll(async () => {
  await h.close();
});

describe('admin users list', () => {
  it('stats are permission-gated and consistent with the list totals', async () => {
    expect((await h.get('/admin/users/stats', limited.token)).status).toBe(403);
    const stats = await h.get('/admin/users/stats', superAdmin.token);
    expect(stats.status).toBe(200);
    const all = await h.get('/admin/users?page=1&limit=1', superAdmin.token);
    expect(stats.data.total.all).toBe(all.data.total);
    const active = await h.get('/admin/users?page=1&limit=1&status=ACTIVE', superAdmin.token);
    expect(stats.data.active.all).toBe(active.data.total);
    const masters = await h.get('/admin/users?page=1&limit=1&role=MASTER', superAdmin.token);
    expect(stats.data.total.masters).toBe(masters.data.total);
  });

  it('paginates by page number with a stable total and enriched rows', async () => {
    const first = await h.get('/admin/users?page=1&limit=2', superAdmin.token);
    expect(first.data.items).toHaveLength(2);
    expect(first.data.pages).toBe(Math.ceil(first.data.total / 2));
    const second = await h.get('/admin/users?page=2&limit=2', superAdmin.token);
    expect(second.data.items.map((u: { id: string }) => u.id)).not.toEqual(first.data.items.map((u: { id: string }) => u.id));
    const row = first.data.items[0];
    expect(row).toEqual(expect.objectContaining({ accountNumber: expect.any(Number), ordersCount: expect.any(Number), subscription: null }));
    expect(row.roles).not.toContain('ADMIN');
  });

  it('filters by subscription and shows the active plan', async () => {
    await h.post('/admin/subscriptions/grant', superAdmin.token, { user: customers[0]!.id, planCode: 'CUSTOMER_PLUS', months: 2 });
    const withSub = await h.get('/admin/users?page=1&limit=100&subscription=CUSTOMER_PLUS', superAdmin.token);
    const row = withSub.data.items.find((u: { id: string }) => u.id === customers[0]!.id);
    expect(row.subscription).toEqual(expect.objectContaining({ planCode: 'CUSTOMER_PLUS', planName: 'Plus' }));
    expect(row.subscription.daysLeft).toBeGreaterThan(50);
    const without = await h.get('/admin/users?page=1&limit=100&subscription=none', superAdmin.token);
    expect(without.data.items.some((u: { id: string }) => u.id === customers[0]!.id)).toBe(false);
    const detail = await h.get(`/admin/users/by-number/${row.accountNumber}`, superAdmin.token);
    expect(detail.data.subscription.planName).toBe('Plus');
    expect(detail.data.subscriptionHistory[0].planName).toBe('Plus');
    expect(detail.data.subscriptionSummary).toEqual(expect.objectContaining({ everSubscribed: true, total: 1, gifted: 1, purchased: 0, totalPaid: 0 }));
    expect(detail.data.subscription.source).toBe('GRANT');
    expect(detail.data.activity).toEqual(expect.objectContaining({ spent: 0, earned: null, ordersAsCustomer: {} }));
    expect(detail.data.account).toEqual(expect.objectContaining({ googleLinked: false }));
    const none = await h.get(`/admin/users/by-number/${(await h.db.user.findUniqueOrThrow({ where: { id: customers[2]!.id } })).accountNumber}`, superAdmin.token);
    expect(none.data.subscriptionSummary.everSubscribed).toBe(false);
  });

  it('bulk status updates users one by one and reports failures instead of failing the whole batch', async () => {
    const ids = [customers[1]!.id, customers[2]!.id, superAdmin.id];
    const noReason = await h.post('/admin/users/bulk-status', superAdmin.token, { ids, status: 'BLOCKED' }); // sabab yo‘q: hech biri o‘zgarmaydi
    expect(noReason.data.updated).toBe(0);
    expect(noReason.data.failed).toHaveLength(3);
    const res = await h.post('/admin/users/bulk-status', superAdmin.token, { ids, status: 'BLOCKED', reason: 'Test: ommaviy bloklash' });
    expect(res.data.updated).toBe(2);
    expect(res.data.failed).toHaveLength(1);
    expect(res.data.failed[0].id).toBe(superAdmin.id);
    const blocked = await h.get('/admin/users?page=1&limit=100&status=BLOCKED', superAdmin.token);
    expect(blocked.data.items.map((u: { id: string }) => u.id)).toEqual(expect.arrayContaining([customers[1]!.id, customers[2]!.id]));
    const back = await h.post('/admin/users/bulk-status', superAdmin.token, { ids: [customers[1]!.id, customers[2]!.id], status: 'ACTIVE' });
    expect(back.data.updated).toBe(2);
    expect(await h.db.auditLog.count({ where: { targetId: customers[1]!.id, action: 'ADMIN_USER_BLOCKED' } })).toBe(1);
  });

  it('searches by full name and sorts by name', async () => {
    await h.db.user.update({ where: { id: master.id }, data: { firstName: 'Zokirjon', lastName: 'Testov' } });
    const hit = await h.get('/admin/users?page=1&limit=10&search=Zokirjon%20Testov', superAdmin.token);
    expect(hit.data.items.map((u: { id: string }) => u.id)).toContain(master.id);
    const sorted = await h.get('/admin/users?page=1&limit=100&sort=name&dir=asc', superAdmin.token);
    const names = sorted.data.items.map((u: { firstName: string | null }) => (u.firstName ?? '').toLowerCase());
    expect(names.length).toBeGreaterThan(2);
    expect(names[0].localeCompare(names[names.length - 1], 'en')).toBeLessThanOrEqual(0);
    expect((await h.get('/admin/users?page=0', superAdmin.token)).status).toBe(400);
    expect((await h.get('/admin/users?sort=password', superAdmin.token)).status).toBe(400);
  });
});

describe('admin accounts list', () => {
  it('returns stats, devices and details only within the actor scope', async () => {
    const list = await h.get('/admin/admins', superAdmin.token);
    expect(list.status).toBe(200);
    expect(list.data.stats.total).toBe(list.data.items.length);
    expect(list.data.stats.mfaOn + list.data.stats.mfaOff).toBe(list.data.stats.total);
    expect(list.data.items[0]).toEqual(expect.objectContaining({ activeDevices: expect.any(Number), email: null }));
    const details = await h.get(`/admin/admins/${limited.id}/details`, superAdmin.token);
    expect(details.status).toBe(200);
    expect(details.data).toEqual(expect.objectContaining({ sessions: expect.any(Array), activity: expect.any(Array), actions30d: expect.any(Number) }));
    // oddiy admin (vakolatsiz) ro‘yxat va tafsilotni ko‘ra olmaydi
    expect((await h.get('/admin/admins', limited.token)).status).toBe(403);
    expect((await h.get(`/admin/admins/${superAdmin.id}/details`, limited.token)).status).toBe(403);
    // oddiy foydalanuvchi id'si admin tafsiloti sifatida ochilmaydi
    expect((await h.get(`/admin/admins/${customers[0]!.id}/details`, superAdmin.token)).status).toBe(404);
  });
});
