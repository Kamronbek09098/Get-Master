import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NotificationService } from '../../src/modules/notification/notification.service';
import { bookOrder, bootHarness, createMaster, createUser, firstService, type Harness, MISSING_UUID, type TestMaster, type TestUser, waitFor } from '../helpers/harness';

let h: Harness;
let service: { id: string };
let alice: TestUser;
let bob: TestUser;
let master: TestMaster;

beforeAll(async () => {
  h = await bootHarness();
  service = await firstService(h);
  alice = await createUser(h, ['CUSTOMER'], { firstName: 'Alice' });
  bob = await createUser(h, ['CUSTOMER'], { firstName: 'Bob' });
  master = await createMaster(h, service.id);
});
afterAll(async () => {
  await h.close();
});

describe('M01 — customer profile & preferences', () => {
  it('requires authentication and the CUSTOMER role', async () => {
    expect((await h.get('/customers/me/preferences')).status).toBe(401);
    expect((await h.get('/customers/me/preferences', (await createUser(h, ['ADMIN'])).token)).status).toBe(403);
  });

  it('returns defaults, merges partial updates and never wipes other keys', async () => {
    expect((await h.get('/customers/me/preferences', alice.token)).data).toEqual({ language: 'UZ', currency: 'UZS', notificationsEnabled: true });
    await h.patch('/customers/me/preferences', alice.token, { language: 'RU' });
    const second = await h.patch('/customers/me/preferences', alice.token, { notificationsEnabled: false });
    expect(second.data).toEqual({ language: 'RU', currency: 'UZS', notificationsEnabled: false });
    expect((await h.get('/customers/me/preferences', alice.token)).data.language).toBe('RU');
  });

  it("is ownership-scoped: one customer's preferences never leak into another's", async () => {
    expect((await h.get('/customers/me/preferences', bob.token)).data.language).toBe('UZ');
  });

  it('whitelists keys and validates values (no stored-JSON pollution, no id smuggling)', async () => {
    expect((await h.patch('/customers/me/preferences', alice.token, { language: 'XX' })).status).toBe(400);
    expect((await h.patch('/customers/me/preferences', alice.token, { isAdmin: true })).status).toBe(400);
    expect((await h.patch('/customers/me/preferences', alice.token, { userId: bob.id, language: 'EN' })).status).toBe(400);
    const stored = await h.db.user.findUniqueOrThrow({ where: { id: alice.id }, select: { preferences: true } });
    expect(Object.keys(stored.preferences as object).sort()).toEqual(['currency', 'language', 'notificationsEnabled']);
  });

  it('profile names are editable, credentials are not', async () => {
    const ok = await h.patch('/customers/me', alice.token, { firstName: 'Alicia' });
    expect(ok.data.firstName).toBe('Alicia');
    expect((await h.patch('/customers/me', alice.token, { phone: '+998900000000' })).status).toBe(400);
    expect((await h.patch('/customers/me', alice.token, { firstName: '' })).status).toBe(400);
    expect(JSON.stringify(ok.body)).not.toMatch(/passwordHash/);
  });
});

describe('M02 — notifications', () => {
  let notifications: NotificationService;
  const ids: string[] = [];

  beforeAll(async () => {
    notifications = h.app.get(NotificationService);
    for (let i = 0; i < 5; i += 1) {
      const n = await notifications.create({ userId: alice.id, channel: 'IN_APP', title: `Title ${i}`, body: `Body ${i}` });
      ids.push(n.id);
    }
    await notifications.create({ userId: bob.id, channel: 'IN_APP', title: 'Bob only', body: 'secret' });
  });

  it('creating a notification queues its delivery through the outbox → BullMQ, which marks IN_APP as SENT exactly once', async () => {
    const id = ids[0]!;
    const event = await waitFor(
      async () => {
        const e = await h.db.outboxEvent.findFirst({ where: { eventName: 'notification.deliver', aggregateId: id } });
        return e?.status === 'PUBLISHED' ? e : null;
      },
      { label: 'notification.deliver PUBLISHED' },
    );
    expect(event.attempts).toBe(1);
    const row = await h.db.notification.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('SENT');
    expect(row.sentAt).not.toBeNull();
    expect(await h.db.outboxEvent.count({ where: { eventName: 'notification.deliver', aggregateId: id } })).toBe(1);
  });

  it('an identical notification within a minute is deduplicated', async () => {
    const a = await notifications.create({ userId: bob.id, channel: 'IN_APP', title: 'Dup', body: 'same' });
    const b = await notifications.create({ userId: bob.id, channel: 'IN_APP', title: 'Dup', body: 'same' });
    expect(b.id).toBe(a.id);
  });

  it('lists only my notifications (BOLA) with cursor pagination', async () => {
    const mine = await h.get('/notifications?limit=2', alice.token);
    expect(mine.status).toBe(200);
    expect(mine.data.items).toHaveLength(2);
    expect(mine.data.nextCursor).toBeTruthy();
    const seen = new Set<string>(mine.data.items.map((n: any) => n.id));
    let cursor = mine.data.nextCursor;
    while (cursor) {
      const page = await h.get(`/notifications?limit=2&cursor=${cursor}`, alice.token);
      for (const n of page.data.items) {
        expect(seen.has(n.id)).toBe(false);
        seen.add(n.id);
      }
      cursor = page.data.nextCursor;
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
    expect([...seen].every((id) => id !== undefined)).toBe(true);
    const all = await h.db.notification.findMany({ where: { id: { in: [...seen] } }, select: { userId: true } });
    expect(all.every((n) => n.userId === alice.id)).toBe(true);
  });

  it("another user's notification is invisible: 404 on read/get, unchanged in DB", async () => {
    const bobs = await h.db.notification.findFirstOrThrow({ where: { userId: bob.id, title: 'Bob only' } });
    expect((await h.get(`/notifications/${bobs.id}`, alice.token)).status).toBe(404);
    expect((await h.patch(`/notifications/${bobs.id}/read`, alice.token)).status).toBe(404);
    expect((await h.db.notification.findUniqueOrThrow({ where: { id: bobs.id } })).status).not.toBe('READ');
    expect((await h.get(`/notifications/${MISSING_UUID}`, alice.token)).status).toBe(404);
  });

  it('unread count, mark-one and mark-all are consistent', async () => {
    const before = (await h.get('/notifications/meta/unread-count', alice.token)).data.count;
    expect(before).toBeGreaterThanOrEqual(5);
    const read = await h.patch(`/notifications/${ids[1]}/read`, alice.token);
    expect(read.data.status).toBe('READ');
    expect((await h.patch(`/notifications/${ids[1]}/read`, alice.token)).status).toBe(200);
    expect((await h.get('/notifications/meta/unread-count', alice.token)).data.count).toBe(before - 1);
    const all = await h.patch('/notifications/read-all', alice.token);
    expect(all.data.count).toBe(before - 1);
    expect((await h.get('/notifications/meta/unread-count', alice.token)).data.count).toBe(0);
    expect((await h.get('/notifications/meta/unread-count', bob.token)).data.count).toBeGreaterThan(0);
  });

  it('validates filters and limits', async () => {
    expect((await h.get('/notifications?channel=CARRIER_PIGEON', alice.token)).status).toBe(400);
    expect((await h.get('/notifications?limit=101', alice.token)).status).toBe(400);
    expect((await h.get('/notifications?cursor=nope', alice.token)).status).toBe(400);
    expect((await h.get('/notifications?status=SENT', alice.token)).status).toBe(200);
  });

  it('domain events (order booked / status change) create exactly one notification each via the outbox', async () => {
    const order = await bookOrder(h, alice, master, service.id);
    await waitFor(
      async () => (await h.db.outboxEvent.findFirst({ where: { eventName: 'order.booked', aggregateId: order.orderId, status: 'PUBLISHED' } })) ?? null,
      { label: 'order.booked published' },
    );
    const forMaster = await h.db.notification.findMany({ where: { userId: master.id, template: 'order.booked' } });
    expect(forMaster).toHaveLength(1);

    expect((await h.post(`/orders/${order.orderId}/confirm`, master.token)).status).toBe(201);
    const changed = await waitFor(
      async () => {
        const rows = await h.db.notification.findMany({ where: { userId: alice.id, template: 'order.status_changed' } });
        return rows.length > 0 ? rows : null;
      },
      { label: 'status-changed notification' },
    );
    expect(changed).toHaveLength(1);
    // Bildirishnoma matni endi texnik holat emas, oddiy tilda joriy vaziyatni tushuntiradi.
    expect(changed[0]!.body).toContain('Usta buyurtmangizni qabul qildi va tasdiqladi.');
    expect(await h.db.notification.count({ where: { userId: master.id, template: 'order.status_changed' } })).toBe(0);
  });
});

describe('M03 — order history', () => {
  let masterA: TestMaster;
  let orderId: string;
  let outsider: TestUser;

  beforeAll(async () => {
    masterA = await createMaster(h, service.id, { firstName: 'Hist' });
    outsider = await createUser(h, ['CUSTOMER']);
    orderId = (await bookOrder(h, bob, masterA, service.id)).orderId;
    await bookOrder(h, bob, masterA, service.id);
    await bookOrder(h, bob, masterA, service.id);
  });

  it('shows each participant only their own orders (BOLA) — customer and master views', async () => {
    const asCustomer = await h.get('/orders/history?limit=50', bob.token);
    const asMaster = await h.get('/orders/history?limit=50', masterA.token);
    const asOutsider = await h.get('/orders/history?limit=50', outsider.token);
    expect(asCustomer.data.items.length).toBeGreaterThanOrEqual(3);
    expect(asMaster.data.items.length).toBe(3);
    expect(asOutsider.data.items).toEqual([]);
    expect(asMaster.data.items.map((o: any) => o.id)).toContain(orderId);
  });

  it('does not expose counterpart contact data or payment internals', async () => {
    const res = await h.get('/orders/history?limit=1', bob.token);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(masterA.phone);
    expect(text).not.toMatch(/phone|email|passwordHash|providerPaymentId/);
    expect(res.data.items[0].master.user.firstName).toBe('Hist');
  });

  it('paginates by cursor without duplicates or gaps', async () => {
    const p1 = await h.get('/orders/history?limit=2', masterA.token);
    expect(p1.data.items).toHaveLength(2);
    const p2 = await h.get(`/orders/history?limit=2&cursor=${p1.data.nextCursor}`, masterA.token);
    expect(p2.data.items).toHaveLength(1);
    expect(p2.data.nextCursor).toBeNull();
    const ids = [...p1.data.items, ...p2.data.items].map((o: any) => o.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('filters by status and date range; rejects bad values', async () => {
    expect((await h.get('/orders/history?status=COMPLETED', masterA.token)).data.items).toEqual([]);
    expect((await h.get('/orders/history?status=BOOKED', masterA.token)).data.items).toHaveLength(3);
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect((await h.get(`/orders/history?dateFrom=${encodeURIComponent(future)}`, masterA.token)).data.items).toEqual([]);
    expect((await h.get('/orders/history?status=NOPE', masterA.token)).status).toBe(400);
    expect((await h.get('/orders/history?dateFrom=yesterday-ish', masterA.token)).status).toBe(400);
  });

  it('GET /orders/:id is participants-only', async () => {
    expect((await h.get(`/orders/${orderId}`, bob.token)).status).toBe(200);
    expect((await h.get(`/orders/${orderId}`, masterA.token)).status).toBe(200);
    expect((await h.get(`/orders/${orderId}`, outsider.token)).status).toBe(403);
    expect((await h.get(`/orders/${MISSING_UUID}`, bob.token)).status).toBe(404);
  });
});
