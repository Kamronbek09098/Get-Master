import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookOrder, bootHarness, createAdmin, createMaster, createUser, firstService, freshService, type Harness, openRequest, type TestMaster, type TestUser } from '../helpers/harness';

let h: Harness;
let service: { id: string; categoryId: string };
let admin: TestUser;
let customer: TestUser;
let master: TestMaster;

beforeAll(async () => {
  h = await bootHarness();
  service = await firstService(h);
  admin = await createAdmin(h);
  customer = await createUser(h, ['CUSTOMER']);
  master = await createMaster(h, service.id);
});
afterAll(async () => {
  await h.close();
});

async function notify(requestId: string, masterId: string, status: 'NOTIFIED' | 'CANDIDATE' = 'NOTIFIED') {
  const run = await h.db.matchingRun.create({ data: { requestId, status: 'COMPLETED' } });
  await h.db.matchingResult.create({ data: { runId: run.id, masterId, status } });
}

describe('GET /masters/me/incoming-requests', () => {
  it('lists only requests the master was notified about, and only while they can still take offers', async () => {
    const open = await openRequest(h, customer, service.id);
    const candidateOnly = await openRequest(h, customer, service.id);
    const cancelled = await openRequest(h, customer, service.id);
    await notify(open, master.masterId);
    await notify(candidateOnly, master.masterId, 'CANDIDATE');
    await notify(cancelled, master.masterId);
    await h.db.problemRequest.update({ where: { id: cancelled }, data: { status: 'CANCELLED' } });

    const res = await h.get('/masters/me/incoming-requests', master.token);
    expect(res.status).toBe(200);
    const ids = res.data.items.map((item: { request: { id: string } }) => item.request.id);
    expect(ids).toContain(open);
    expect(ids).not.toContain(candidateOnly);
    expect(ids).not.toContain(cancelled);
    expect(res.data.items.find((item: { request: { id: string } }) => item.request.id === open).request.offers).toEqual([]);
  });

  it('shows the master’s own offer on the request and never leaks other masters’ offers', async () => {
    const other = await createMaster(h, service.id);
    const requestId = await openRequest(h, customer, service.id);
    await notify(requestId, master.masterId);
    await h.post('/offers', other.token, { requestId, price: 90000 });
    const mine = await h.post('/offers', master.token, { requestId, price: 100000 });
    expect(mine.status).toBe(201);

    const res = await h.get('/masters/me/incoming-requests', master.token);
    const row = res.data.items.find((item: { request: { id: string } }) => item.request.id === requestId);
    expect(row.request.offers).toHaveLength(1);
    expect(row.request.offers[0].id).toBe(mine.data.id);
  });

  it('is restricted to masters and requires authentication', async () => {
    expect((await h.get('/masters/me/incoming-requests', customer.token)).status).toBe(403);
    expect((await h.get('/masters/me/incoming-requests')).status).toBe(401);
    expect((await h.get('/masters/me/incoming-requests', admin.token)).status).toBe(403);
  });

  it('paginates with a cursor', async () => {
    const fresh = await createMaster(h, service.id);
    for (let i = 0; i < 3; i += 1) await notify(await openRequest(h, customer, service.id), fresh.masterId);
    const first = await h.get('/masters/me/incoming-requests?limit=2', fresh.token);
    expect(first.data.items).toHaveLength(2);
    expect(first.data.nextCursor).toBeTruthy();
    const second = await h.get(`/masters/me/incoming-requests?limit=2&cursor=${first.data.nextCursor}`, fresh.token);
    expect(second.data.items).toHaveLength(1);
    expect(second.data.nextCursor).toBeNull();
  });
});

describe('GET /disputes/admin/all', () => {
  it('lets an admin see every dispute (and only disputes), filtered by status', async () => {
    const booked = await bookOrder(h, customer, master, service.id);
    await h.db.order.update({ where: { id: booked.orderId }, data: { status: 'COMPLETED' } });
    const dispute = await h.post('/disputes', customer.token, { orderId: booked.orderId, title: 'Not done', description: 'The work was never finished properly.' });
    expect(dispute.status).toBe(201);
    const complaint = await h.post('/complaints', customer.token, { title: 'Rude master', description: 'The master was rude during the visit.' });
    expect(complaint.status).toBe(201);

    const all = await h.get('/disputes/admin/all', admin.token);
    expect(all.status).toBe(200);
    const ids = all.data.items.map((item: { id: string }) => item.id);
    expect(ids).toContain(dispute.data.id);
    expect(ids).not.toContain(complaint.data.id);

    const filtered = await h.get('/disputes/admin/all?status=RESOLVED', admin.token);
    expect(filtered.data.items.map((item: { id: string }) => item.id)).not.toContain(dispute.data.id);
  });

  it('is admin-only', async () => {
    expect((await h.get('/disputes/admin/all', customer.token)).status).toBe(403);
    expect((await h.get('/disputes/admin/all', master.token)).status).toBe(403);
    expect((await h.get('/disputes/admin/all')).status).toBe(401);
  });
});

describe('GET /masters/me/open-requests — open requests the master can accept', () => {
  type Item = { id: string; notified: boolean; offersCount: number; myOffer: { status: string } | null; suggested: { price: string; estimatedMinutes: number } | null };
  const idsOf = (res: { data: { items: Item[] } }) => res.data.items.map((item) => item.id);

  it('shows every open request by default, scope=mine narrows to my services, and never my own, closed or expired ones', async () => {
    const owner = await createUser(h, ['CUSTOMER']);
    const me = await createMaster(h, service.id);
    const other = await freshService(h);

    const mine = await openRequest(h, owner, service.id);
    const foreign = await openRequest(h, owner, other.id);
    const own = await openRequest(h, me, service.id);
    const cancelled = await openRequest(h, owner, service.id);
    await h.db.problemRequest.update({ where: { id: cancelled }, data: { status: 'CANCELLED' } });
    const expired = await openRequest(h, owner, service.id);
    await h.db.problemRequest.update({ where: { id: expired }, data: { expiresAt: new Date(Date.now() - 60_000) } });

    const defaults = idsOf(await h.get('/masters/me/open-requests?limit=100', me.token));
    expect(defaults).toEqual(expect.arrayContaining([mine, foreign]));
    for (const excluded of [own, cancelled, expired]) expect(defaults).not.toContain(excluded);

    const suited = idsOf(await h.get('/masters/me/open-requests?scope=mine&limit=100', me.token));
    expect(suited).toContain(mine);
    expect(suited).not.toContain(foreign);
  });

  it('includes requests notified to me even for other services, and says so', async () => {
    const owner = await createUser(h, ['CUSTOMER']);
    const me = await createMaster(h, service.id);
    const other = await freshService(h);
    const notifiedRequest = await openRequest(h, owner, other.id);
    await notify(notifiedRequest, me.masterId);

    const res = await h.get('/masters/me/open-requests?scope=mine&limit=100', me.token);
    const item = res.data.items.find((entry: Item) => entry.id === notifiedRequest);
    expect(item).toBeDefined();
    expect(item.notified).toBe(true);
  });

  it('suggests my own price/duration for the service, and reflects offers (count and my own)', async () => {
    const owner = await createUser(h, ['CUSTOMER']);
    const me = await createMaster(h, service.id);
    const rival = await createMaster(h, service.id);
    const requestId = await openRequest(h, owner, service.id);

    const before = (await h.get('/masters/me/open-requests?limit=100', me.token)).data.items.find((entry: Item) => entry.id === requestId);
    expect(before).toMatchObject({ offersCount: 0, myOffer: null, notified: false, suggested: { estimatedMinutes: 60 } });
    expect(Number(before.suggested.price)).toBe(100000);

    await h.post('/offers', rival.token, { requestId, price: 90000 });
    expect((await h.post('/offers', me.token, { requestId, price: 120000 })).status).toBe(201);
    const after = (await h.get('/masters/me/open-requests?limit=100', me.token)).data.items.find((entry: Item) => entry.id === requestId);
    expect(after).toMatchObject({ offersCount: 2, myOffer: { status: 'PENDING' } });
  });

  it('is restricted to masters, validates scope, and paginates', async () => {
    const owner = await createUser(h, ['CUSTOMER']);
    const me = await createMaster(h, service.id);
    expect((await h.get('/masters/me/open-requests', owner.token)).status).toBe(403);
    expect((await h.get('/masters/me/open-requests', admin.token)).status).toBe(403);
    expect((await h.get('/masters/me/open-requests')).status).toBe(401);
    expect((await h.get('/masters/me/open-requests?scope=bogus', me.token)).status).toBe(400);

    for (let i = 0; i < 3; i += 1) await openRequest(h, owner, service.id);
    const first = await h.get('/masters/me/open-requests?limit=2', me.token);
    expect(first.data.items).toHaveLength(2);
    expect(first.data.nextCursor).toBeTruthy();
    const second = await h.get(`/masters/me/open-requests?limit=2&cursor=${first.data.nextCursor}`, me.token);
    expect(second.data.items.length).toBeGreaterThan(0);
    expect(second.data.items[0].id).not.toBe(first.data.items[0].id);
  });
});

describe('a customer and a master that are the same account never deal with each other', () => {
  it('cannot offer on, accept, or even see anything of their own customer-side work', async () => {
    const me = await createMaster(h, service.id);
    const stranger = await createUser(h, ['CUSTOMER']);
    const ownRequest = await openRequest(h, me, service.id);
    const strangerRequest = await openRequest(h, stranger, service.id);

    expect((await h.post('/offers', me.token, { requestId: ownRequest, price: 150000 })).status).toBe(403);
    expect(await h.db.offer.count({ where: { requestId: ownRequest } })).toBe(0);

    const open = (await h.get('/masters/me/open-requests?scope=all&limit=100', me.token)).data.items.map((i: { id: string }) => i.id);
    expect(open).toContain(strangerRequest);
    expect(open).not.toContain(ownRequest);

    const rival = await createMaster(h, service.id);
    const rivalOffer = await h.post('/offers', rival.token, { requestId: ownRequest, price: 90000 });
    expect(rivalOffer.status).toBe(201);
    await h.db.offer.create({
      data: { requestId: ownRequest, masterId: me.masterId, price: 1000, expiresAt: new Date(Date.now() + 3_600_000) },
    });
    const seen = (await h.get(`/problem-requests/${ownRequest}/offers`, me.token)).data?.items?.map((o: { id: string }) => o.id) ?? [];
    expect(seen).toContain(rivalOffer.data.id);
    expect(seen).toHaveLength(1);
    const selfOffer = await h.db.offer.findFirstOrThrow({ where: { requestId: ownRequest, masterId: me.masterId } });
    expect((await h.post(`/offers/${selfOffer.id}/accept`, me.token, undefined, { idempotent: true })).status).toBe(403);
    expect((await h.get(`/offers/${selfOffer.id}`, me.token)).status).toBe(404);
    expect((await h.get('/offers/mine', me.token)).data.items.map((o: { id: string }) => o.id)).not.toContain(selfOffer.id);
  });

  it('hides an already existing order, booking and conversation between the same account', async () => {
    const me = await createMaster(h, service.id);
    const requestId = await openRequest(h, me, service.id);
    const offer = await h.db.offer.create({
      data: { requestId, masterId: me.masterId, price: 1000, expiresAt: new Date(Date.now() + 3_600_000) },
    });
    const booking = await h.db.booking.create({
      data: { requestId, offerId: offer.id, customerId: me.id, masterId: me.masterId, agreedPrice: 1000 },
    });
    const order = await h.db.order.create({
      data: { bookingId: booking.id, customerId: me.id, masterId: me.masterId, status: 'BOOKED', originalAmount: 1000, finalAmount: 1000 },
    });
    await h.db.conversation.create({ data: { type: 'ORDER', orderId: order.id, participants: { create: [{ userId: me.id, roles: ['CUSTOMER', 'MASTER'] }] } } });

    expect((await h.get('/orders', me.token)).data.map((o: { id: string }) => o.id)).not.toContain(order.id);
    expect((await h.get(`/orders/${order.id}`, me.token)).status).toBe(404);
    expect((await h.post(`/orders/${order.id}/confirm`, me.token)).status).toBe(404);
    expect((await h.get('/bookings', me.token)).data.map((b: { id: string }) => b.id)).not.toContain(booking.id);
    const chats = await h.get('/conversations?limit=100', me.token);
    expect(chats.data.items.some((c: { orderId: string | null }) => c.orderId === order.id)).toBe(false);
  });
});
