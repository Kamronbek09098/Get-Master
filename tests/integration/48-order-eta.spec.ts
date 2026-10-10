import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookOrder, bootHarness, createMaster, createUser, firstService, type Harness, type TestMaster, type TestUser } from '../helpers/harness';

let h: Harness;
let customer: TestUser;
let stranger: TestUser;
let master: TestMaster;
let orderId: string;

beforeAll(async () => {
  h = await bootHarness();
  const service = await firstService(h);
  customer = await createUser(h, ['CUSTOMER']);
  stranger = await createUser(h, ['CUSTOMER']);
  master = await createMaster(h, service.id);
  orderId = (await bookOrder(h, customer, master, service.id)).orderId;
});
afterAll(async () => {
  await h.close();
});

describe('estimated arrival time shared from the master navigator', () => {
  it('has no ETA until the master is on the way, and only the master can report it', async () => {
    expect((await h.get(`/orders/${orderId}/eta`, customer.token)).data.eta).toBeNull();
    await h.post(`/orders/${orderId}/confirm`, master.token);
    expect((await h.post(`/orders/${orderId}/eta`, master.token, { remainingS: 600, remainingM: 3000 })).status).toBe(409);
    await h.post(`/orders/${orderId}/start-travel`, master.token);
    expect((await h.post(`/orders/${orderId}/eta`, customer.token, { remainingS: 600, remainingM: 3000 })).status).toBe(403);
    expect((await h.post(`/orders/${orderId}/eta`, master.token, { remainingS: -5, remainingM: 3000 })).status).toBe(400);
  });

  it('shows the master’s navigator value to the customer, hides it from strangers and after arrival', async () => {
    const saved = await h.post(`/orders/${orderId}/eta`, master.token, { remainingS: 600, remainingM: 3000 });
    expect(saved.status).toBe(201);
    const seen = await h.get(`/orders/${orderId}/eta`, customer.token);
    expect(seen.data.eta).toMatchObject({ remainingS: 600, remainingM: 3000 });
    expect(new Date(seen.data.eta.arriveAt).getTime()).toBeGreaterThan(Date.now() + 500_000);
    expect((await h.get(`/orders/${orderId}/eta`, stranger.token)).status).toBe(403);
    const order = await h.db.order.findUniqueOrThrow({ where: { id: orderId }, select: { bookingId: true } });
    await h.db.booking.update({ where: { id: order.bookingId }, data: { locationSnapshot: { addressLine: 'Koordinatasiz' } } });
    await h.post(`/orders/${orderId}/arrive`, master.token);
    expect((await h.get(`/orders/${orderId}/eta`, customer.token)).data.eta).toBeNull();
  });
});

describe('«Yetib keldim» only near the customer’s address', () => {
  it('requires GPS and rejects a far position when the address has coordinates, accepts a nearby one', async () => {
    const service = await firstService(h);
    const pro = await createMaster(h, service.id);
    const placed = await bookOrder(h, customer, pro, service.id);
    const id = placed.orderId;
    await h.post(`/orders/${id}/confirm`, pro.token);
    await h.post(`/orders/${id}/start-travel`, pro.token);
    await h.db.booking.update({ where: { id: placed.bookingId }, data: { locationSnapshot: { latitude: 41.3, longitude: 69.2, addressLine: 'Test' } } });

    const none = await h.post(`/orders/${id}/arrive`, pro.token);
    expect(none.status).toBe(400);
    const far = await h.post(`/orders/${id}/arrive`, pro.token, { latitude: 41.31, longitude: 69.2, accuracy: 10 });
    expect(far.status).toBe(403);
    expect((await h.db.order.findUniqueOrThrow({ where: { id } })).status).toBe('ON_THE_WAY');
    const near = await h.post(`/orders/${id}/arrive`, pro.token, { latitude: 41.3004, longitude: 69.2, accuracy: 10 });
    expect(near.status).toBe(201);
    expect(near.data.status).toBe('ARRIVED');
  });

  it('does not require GPS when the address has no coordinates', async () => {
    const service = await firstService(h);
    const pro = await createMaster(h, service.id);
    const placed = await bookOrder(h, customer, pro, service.id);
    await h.db.booking.update({ where: { id: placed.bookingId }, data: { locationSnapshot: { addressLine: 'Koordinatasiz' } } });
    await h.post(`/orders/${placed.orderId}/confirm`, pro.token);
    await h.post(`/orders/${placed.orderId}/start-travel`, pro.token);
    expect((await h.post(`/orders/${placed.orderId}/arrive`, pro.token)).status).toBe(201);
  });
});
