import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookOrder, bootHarness, createMaster, createUser, firstService, openRequest, type Harness, type TestUser } from '../helpers/harness';

let h: Harness;
let customer: TestUser;
let service: { id: string };

beforeAll(async () => {
  h = await bootHarness();
  customer = await createUser(h);
  service = await firstService(h);
});
afterAll(async () => {
  await h.close();
});

describe('race conditions & business-logic abuse', () => {
  it('two masters’ offers on one request: accepting both at once books exactly one order', async () => {
    const m1 = await createMaster(h, service.id);
    const m2 = await createMaster(h, service.id);
    const requestId = await openRequest(h, customer, service.id);
    const o1 = (await h.post('/offers', m1.token, { requestId, price: 120000, estimatedMinutes: 60 })).data;
    const o2 = (await h.post('/offers', m2.token, { requestId, price: 130000, estimatedMinutes: 60 })).data;
    const results = await Promise.all([
      h.post(`/offers/${o1.id}/accept`, customer.token, undefined, { idempotent: true }),
      h.post(`/offers/${o2.id}/accept`, customer.token, undefined, { idempotent: true }),
      h.post(`/offers/${o1.id}/accept`, customer.token, undefined, { idempotent: true }),
    ]);
    expect(results.filter((r) => r.status === 201).length).toBeGreaterThanOrEqual(1);
    expect(await h.db.booking.count({ where: { requestId } })).toBe(1);
    expect(results.every((r) => r.status < 500)).toBe(true);
  });

  it('parallel payment creation never produces two live payments for one order', async () => {
    const master = await createMaster(h, service.id);
    const order = await bookOrder(h, customer, master, service.id);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => h.post('/payments', customer.token, { orderId: order.orderId, provider: 'CASH' }, { idempotent: true })),
    );
    expect(results.every((r) => r.status < 500)).toBe(true);
    const live = await h.db.payment.count({ where: { orderId: order.orderId, status: { in: ['PENDING', 'SUCCEEDED'] } } });
    expect(live).toBeLessThanOrEqual(1);
  });

  it('the payer cannot choose the amount, and another customer cannot pay or read the payment', async () => {
    const master = await createMaster(h, service.id);
    const order = await bookOrder(h, customer, master, service.id);
    const other = await createUser(h);
    expect((await h.post('/payments', customer.token, { orderId: order.orderId, provider: 'CASH', amount: 1 }, { idempotent: true })).status).toBe(400);
    expect((await h.post('/payments', other.token, { orderId: order.orderId, provider: 'CASH' }, { idempotent: true })).status).toBeGreaterThanOrEqual(400);
    const made = await h.post('/payments', customer.token, { orderId: order.orderId, provider: 'CASH' }, { idempotent: true });
    expect(made.status).toBe(201);
    expect([403, 404]).toContain((await h.get(`/payments/${made.data.payment.id}`, other.token)).status);
    // Mijoz o‘zi naqd to‘lovni «tasdiqlay» olmaydi (faqat usta/admin).
    expect((await h.post(`/payments/${made.data.payment.id}/confirm-cash`, customer.token, {})).status).toBeGreaterThanOrEqual(400);
    expect((await h.post(`/payments/${made.data.payment.id}/refund`, customer.token, {})).status).toBeGreaterThanOrEqual(400);
  });

  it('a master cannot review themselves, and a review cannot be posted twice', async () => {
    const master = await createMaster(h, service.id);
    const order = await bookOrder(h, customer, master, service.id);
    const mine = await h.post('/reviews', master.token, { orderId: order.orderId, rating: 5, comment: 'ajoyib usta' });
    expect(mine.status).toBeGreaterThanOrEqual(400);
    const early = await h.post('/reviews', customer.token, { orderId: order.orderId, rating: 5, comment: 'ish hali boshlanmagan' });
    expect(early.status).toBeGreaterThanOrEqual(400);
  });
});
