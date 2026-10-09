import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookOrder, bootHarness, createMaster, createUser, firstService, runWork, type Harness, type TestMaster, type TestUser } from '../helpers/harness';

let h: Harness;
let customer: TestUser;
let master: TestMaster;
let serviceId: string;

beforeAll(async () => {
  h = await bootHarness();
  serviceId = (await firstService(h)).id;
  customer = await createUser(h);
  master = await createMaster(h, serviceId);
});
afterAll(async () => {
  await h.close();
});

describe('platform commission (5% from the master)', () => {
  it('records the fee and the master share when an order is completed; the customer still pays the agreed price', async () => {
    const order = await bookOrder(h, customer, master, serviceId, { price: 150_000 });
    const before = await h.db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(before.platformFee).toBeNull();
    await runWork(h, order, customer, master, true);
    const done = await h.db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(done.status).toBe('COMPLETED');
    expect(Number(done.finalAmount)).toBe(150_000);
    expect(Number(done.platformFee)).toBe(7_500);
    expect(Number(done.masterAmount)).toBe(142_500);
  });

  it('does not charge a fee for cancelled orders', async () => {
    const order = await bookOrder(h, customer, master, serviceId, { price: 90_000 });
    expect((await h.post(`/orders/${order.orderId}/cancel`, master.token, { reason: 'test' })).status).toBe(201);
    const cancelled = await h.db.order.findUniqueOrThrow({ where: { id: order.orderId } });
    expect(cancelled.platformFee).toBeNull();
    expect(cancelled.masterAmount).toBeNull();
  });
});
