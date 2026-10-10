import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookOrder, bootHarness, createAdmin, createMaster, createSuperAdmin, createUser, firstService, type BookedOrder, type Harness, payOrder, runWork, type TestMaster, type TestUser } from '../helpers/harness';

let h: Harness;
let superAdmin: TestUser;
let noOrders: TestUser;
let customer: TestUser;
let master: TestMaster;
let serviceId: string;
let booked: BookedOrder;
let paid: BookedOrder;

beforeAll(async () => {
  h = await bootHarness();
  superAdmin = await createSuperAdmin(h);
  noOrders = await createAdmin(h, ['USERS']);
  customer = await createUser(h, ['CUSTOMER']);
  serviceId = (await firstService(h)).id;
  master = await createMaster(h, serviceId);
  booked = await bookOrder(h, customer, master, serviceId, { price: 111000 });
  paid = await bookOrder(h, customer, master, serviceId, { price: 222000 });
  await runWork(h, paid, customer, master, false);
  await payOrder(h, customer, paid.orderId);
});
afterAll(async () => {
  await h.close();
});

describe('admin orders list', () => {
  it('needs the ORDERS permission and rejects unknown filters', async () => {
    expect((await h.get('/admin/orders?page=1', noOrders.token)).status).toBe(403);
    expect((await h.get('/admin/orders/facets', noOrders.token)).status).toBe(403);
    expect((await h.get('/admin/orders?payment=WEIRD', superAdmin.token)).status).toBe(400);
    expect((await h.get('/admin/orders?sort=password', superAdmin.token)).status).toBe(400);
  });

  it('paginates by page number, sorts by amount and filters by payment', async () => {
    const all = await h.get('/admin/orders?page=1&limit=2', superAdmin.token);
    expect(all.data.items).toHaveLength(2);
    expect(all.data.pages).toBe(Math.ceil(all.data.total / 2));
    const byAmount = await h.get(`/admin/orders?page=1&limit=100&sort=amount&dir=asc&search=${customer.phone.slice(-9)}`, superAdmin.token);
    const amounts = byAmount.data.items.map((o: { finalAmount: string }) => Number(o.finalAmount));
    expect(amounts).toEqual([...amounts].sort((a: number, b: number) => a - b));
    const succeeded = await h.get(`/admin/orders?page=1&limit=100&payment=SUCCEEDED&search=${customer.phone.slice(-9)}`, superAdmin.token);
    expect(succeeded.data.items.map((o: { id: string }) => o.id)).toEqual([paid.orderId]);
    const none = await h.get(`/admin/orders?page=1&limit=100&payment=NONE&search=${customer.phone.slice(-9)}`, superAdmin.token);
    expect(none.data.items.map((o: { id: string }) => o.id)).toEqual([booked.orderId]);
    expect(succeeded.data.items[0]).toEqual(expect.objectContaining({ customer: expect.objectContaining({ phone: customer.phone }), master: expect.objectContaining({ ratingAvg: expect.anything() }), payment: expect.objectContaining({ status: 'SUCCEEDED' }) }));
  });

  it('summary trends are consistent with the list and facets list real categories', async () => {
    const summary = await h.get('/admin/orders/summary', superAdmin.token);
    const total = await h.get('/admin/orders?page=1&limit=1', superAdmin.token);
    expect(summary.data.total).toBe(total.data.total);
    expect(summary.data.weekAgoTotal).toBeLessThanOrEqual(summary.data.total);
    expect(summary.data.trends.created.current).toBeGreaterThanOrEqual(2);
    const facets = await h.get('/admin/orders/facets', superAdmin.token);
    expect(Array.isArray(facets.data.categories)).toBe(true);
    const ongoing = await h.get('/admin/orders?page=1&limit=1&ongoing=true', superAdmin.token);
    expect(summary.data.active).toBe(ongoing.data.total);
  });

  it('bulk cancel cancels booked orders, reports the rest and writes an audit entry per order', async () => {
    const noReason = await h.post('/admin/orders/bulk-cancel', superAdmin.token, { ids: [booked.orderId], reason: '' });
    expect(noReason.status).toBe(400);
    const res = await h.post('/admin/orders/bulk-cancel', superAdmin.token, { ids: [booked.orderId, paid.orderId], reason: 'Test: ommaviy bekor qilish' });
    expect(res.status).toBe(201);
    expect(res.data.cancelled).toBe(1);
    expect(res.data.failed.map((f: { id: string }) => f.id)).toEqual([paid.orderId]);
    expect((await h.db.order.findUniqueOrThrow({ where: { id: booked.orderId } })).status).toBe('CANCELLED');
    expect(await h.db.auditLog.count({ where: { targetId: booked.orderId, action: 'ADMIN_ORDER_CANCELLED' } })).toBe(1);
  });
});
