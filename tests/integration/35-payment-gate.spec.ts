import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookOrder, bootHarness, createMaster, createUser, firstService, type Harness, payOrder, runWork, type TestMaster, type TestUser } from '../helpers/harness';

let h: Harness;
let customer: TestUser;
let master: TestMaster;
let serviceId: string;

beforeAll(async () => {
  h = await bootHarness();
  customer = await createUser(h, ['CUSTOMER']);
  serviceId = (await firstService(h)).id;
  master = await createMaster(h, serviceId);
});
afterAll(async () => {
  await h.close();
});

/** Ishi tugatilgan (WAITING_CONFIRMATION) buyurtma tayyorlaydi — mijoz hali tasdiqlamagan, to'lov yo'q. */
async function waitingOrder(price: number) {
  const order = await bookOrder(h, customer, master, serviceId, { price });
  await runWork(h, order, customer, master, false);
  expect((await h.db.order.findUniqueOrThrow({ where: { id: order.orderId } })).status).toBe('WAITING_CONFIRMATION');
  return order;
}

describe('order completion requires a fully paid order', () => {
  it('refuses to confirm without any payment (409 PAYMENT_REQUIRED) and keeps the order WAITING_CONFIRMATION', async () => {
    const order = await waitingOrder(100000);
    const res = await h.post(`/orders/${order.orderId}/confirm-completion`, customer.token);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PAYMENT_REQUIRED');
    expect((await h.db.order.findUniqueOrThrow({ where: { id: order.orderId } })).status).toBe('WAITING_CONFIRMATION');
  });

  it('merely choosing a payment method (a PENDING payment) is not enough, and the old paymentMethod body field creates no payment', async () => {
    const order = await waitingOrder(110000);
    const withMethod = await h.post(`/orders/${order.orderId}/confirm-completion`, customer.token, { paymentMethod: 'CASH' });
    expect(withMethod.status).toBe(409);
    expect(await h.db.payment.count({ where: { orderId: order.orderId } })).toBe(0);
    expect((await h.post('/payments', customer.token, { orderId: order.orderId, provider: 'CLICK' }, { idempotent: true })).status).toBe(201);
    const pending = await h.post(`/orders/${order.orderId}/confirm-completion`, customer.token);
    expect(pending.status).toBe(409);
    expect(pending.body.code).toBe('PAYMENT_REQUIRED');
  });

  it('a failed or cancelled payment does not count', async () => {
    const order = await waitingOrder(120000);
    await payOrder(h, customer, order.orderId, 'FAILED');
    expect((await h.post(`/orders/${order.orderId}/confirm-completion`, customer.token)).status).toBe(409);
  });

  it('cash: only after the master confirms receiving the money can the customer confirm the work', async () => {
    const order = await waitingOrder(130000);
    const cash = await h.post('/payments', customer.token, { orderId: order.orderId, provider: 'CASH' }, { idempotent: true });
    expect(cash.status).toBe(201);
    expect((await h.post(`/orders/${order.orderId}/confirm-completion`, customer.token)).status).toBe(409);
    // Mijoz o'zi naqd to'lovni tasdiqlay olmaydi.
    expect((await h.post(`/payments/${cash.data.payment.id}/confirm-cash`, customer.token)).status).toBe(403);
    expect((await h.post(`/payments/${cash.data.payment.id}/confirm-cash`, master.token)).status).toBeLessThan(300);
    const done = await h.post(`/orders/${order.orderId}/confirm-completion`, customer.token);
    expect(done.status).toBe(201);
    expect(done.data.status).toBe('COMPLETED');
  });

  it('a successful online payment unlocks confirmation, and confirmation then completes the order', async () => {
    const order = await waitingOrder(140000);
    await payOrder(h, customer, order.orderId);
    const done = await h.post(`/orders/${order.orderId}/confirm-completion`, customer.token);
    expect(done.status).toBe(201);
    expect(done.data.status).toBe('COMPLETED');
    expect((await h.db.payment.findFirstOrThrow({ where: { orderId: order.orderId, status: 'SUCCEEDED' } })).provider).toBe('CLICK');
  });

  it('a fully refunded payment no longer counts as paid', async () => {
    const order = await waitingOrder(150000);
    const { payment } = await payOrder(h, customer, order.orderId);
    await h.db.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED', refundedAmount: payment.amount } });
    expect((await h.post(`/orders/${order.orderId}/confirm-completion`, customer.token)).status).toBe(409);
  });
});
