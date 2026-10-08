import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookOrder, bootHarness, createMaster, createUser, firstService, openRequest, type Harness, type TestMaster, type TestUser } from '../helpers/harness';

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

const setPaused = (value: boolean) => h.db.masterProfile.update({ where: { id: master.masterId }, data: { isPaused: value, pausedUntil: null } });

describe('a paused master can neither offer nor accept orders', () => {
  it('cannot send an offer while paused, and can again after the pause ends', async () => {
    const requestId = await openRequest(h, customer, serviceId);
    await setPaused(true);
    const blocked = await h.post('/offers', master.token, { requestId, price: 100000, estimatedMinutes: 60 });
    expect(blocked.status).toBe(403);
    expect(JSON.stringify(blocked.body)).toContain('Pauza');
    await setPaused(false);
    expect((await h.post('/offers', master.token, { requestId, price: 100000, estimatedMinutes: 60 })).status).toBe(201);
  });

  it('a customer cannot book an offer from a master who paused afterwards', async () => {
    const requestId = await openRequest(h, customer, serviceId);
    const offer = await h.post('/offers', master.token, { requestId, price: 120000, estimatedMinutes: 60 });
    expect(offer.status).toBe(201);
    await setPaused(true);
    const accepted = await h.post(`/offers/${offer.data.id}/accept`, customer.token, undefined, { idempotent: true });
    expect(accepted.status).toBe(409);
    expect(JSON.stringify(accepted.body)).toContain('pauzada');
    await setPaused(false);
    expect((await h.post(`/offers/${offer.data.id}/accept`, customer.token, undefined, { idempotent: true })).status).toBe(201);
  });

  it('cannot confirm a booked order while paused, but an order already in progress keeps going', async () => {
    const order = await bookOrder(h, customer, master, serviceId);
    await setPaused(true);
    const blocked = await h.post(`/orders/${order.orderId}/confirm`, master.token);
    expect(blocked.status).toBe(403);
    expect(JSON.stringify(blocked.body)).toContain('Pauza');
    await setPaused(false);
    expect((await h.post(`/orders/${order.orderId}/confirm`, master.token)).status).toBe(201);
    await setPaused(true);
    expect((await h.post(`/orders/${order.orderId}/start-travel`, master.token)).status).toBeLessThan(300); // allaqachon qabul qilingan buyurtma davom etadi
  });
});
