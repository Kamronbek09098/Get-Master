import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookOrder, bootHarness, createAdmin, createMaster, createUser, firstService, type Harness, type TestMaster, type TestUser, uploadImage } from '../helpers/harness';

let h: Harness;
let service: { id: string };
let customer: TestUser;
let master: TestMaster;

beforeAll(async () => {
  h = await bootHarness();
  service = await firstService(h);
  customer = await createUser(h, ['CUSTOMER']);
  master = await createMaster(h, service.id);
});
afterAll(async () => {
  await h.close();
});

const open = (token: string | undefined, masterId: string) => h.post('/conversations/direct', token, { masterId });

describe('POST /conversations/direct — chat with a master before any order', () => {
  it('opens a DIRECT conversation between the customer and the master, and is idempotent', async () => {
    const first = await open(customer.token, master.masterId);
    expect(first.status).toBe(201);
    expect(first.data).toMatchObject({ type: 'DIRECT', orderId: null, order: null });
    expect(first.data.participants.map((p: { userId: string }) => p.userId).sort()).toEqual([customer.id, master.id].sort());

    const again = await open(customer.token, master.masterId);
    expect(again.data.id).toBe(first.data.id);
    expect(await h.db.conversation.count({ where: { type: 'DIRECT', participants: { every: { userId: { in: [customer.id, master.id] } } } } })).toBe(1);
  });

  it('a concurrent burst still creates exactly one conversation', async () => {
    const buyer = await createUser(h, ['CUSTOMER']);
    const target = await createMaster(h, service.id);
    const results = await Promise.all(Array.from({ length: 5 }, () => open(buyer.token, target.masterId)));
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(new Set(results.map((r) => r.data.id)).size).toBe(1);
  });

  it('both sides can talk: the master sees the chat, unread count and replies', async () => {
    const buyer = await createUser(h, ['CUSTOMER']);
    const target = await createMaster(h, service.id);
    const conv = (await open(buyer.token, target.masterId)).data;

    expect((await h.post(`/conversations/${conv.id}/messages`, buyer.token, { text: 'Assalomu alaykum, ertaga bo‘shmisiz?' })).status).toBe(201);

    const inbox = await h.get('/conversations', target.token);
    const item = inbox.data.items.find((entry: { id: string }) => entry.id === conv.id);
    expect(item).toMatchObject({ type: 'DIRECT', unreadCount: 1 });
    expect(item.lastMessage.text).toContain('ertaga');
    expect(item.counterpart.id).toBe(buyer.id);

    expect((await h.post(`/conversations/${conv.id}/messages`, target.token, { text: 'Ha, soat 10 da boraman' })).status).toBe(201);
    const thread = await h.get(`/conversations/${conv.id}/messages`, buyer.token);
    expect(thread.data.items).toHaveLength(2);

    const notes = await h.db.notification.count({ where: { userId: target.id, template: 'chat.message' } });
    expect(notes).toBeGreaterThan(0);
  });

  it('exposes when the other side last read the chat, so the sender can show read ticks', async () => {
    const buyer = await createUser(h, ['CUSTOMER']);
    const target = await createMaster(h, service.id);
    const conv = (await open(buyer.token, target.masterId)).data;
    await h.post(`/conversations/${conv.id}/messages`, buyer.token, { text: 'Salom' });

    const before = (await h.get('/conversations', buyer.token)).data.items.find((entry: { id: string }) => entry.id === conv.id);
    expect(before.counterpartLastReadAt).toBeNull();

    expect((await h.post(`/conversations/${conv.id}/read`, target.token)).status).toBe(201);
    const after = (await h.get('/conversations', buyer.token)).data.items.find((entry: { id: string }) => entry.id === conv.id);
    expect(after.counterpartLastReadAt).not.toBeNull();
    expect(new Date(after.counterpartLastReadAt).getTime()).toBeGreaterThanOrEqual(new Date(conv.createdAt).getTime());
  });

  it('is private: an outsider cannot read or write the conversation', async () => {
    const outsider = await createUser(h, ['CUSTOMER']);
    const conv = (await open(customer.token, master.masterId)).data;
    expect((await h.get(`/conversations/${conv.id}`, outsider.token)).status).toBe(403);
    expect((await h.get(`/conversations/${conv.id}/messages`, outsider.token)).status).toBe(403);
    expect((await h.post(`/conversations/${conv.id}/messages`, outsider.token, { text: 'salom' })).status).toBe(403);
  });

  it('refuses chatting with yourself, unknown/unavailable masters, and non-customers', async () => {
    expect((await open(master.token, master.masterId)).status).toBe(403);
    expect((await open(customer.token, '00000000-0000-4000-8000-00000000dead')).status).toBe(404);
    expect((await open(customer.token, 'not-a-uuid')).status).toBe(400);

    const hidden = await createMaster(h, service.id);
    await h.db.masterProfile.update({ where: { id: hidden.masterId }, data: { verification: 'PENDING' } });
    expect((await open(customer.token, hidden.masterId)).status).toBe(404);
    const suspended = await createMaster(h, service.id);
    await h.db.user.update({ where: { id: suspended.id }, data: { status: 'SUSPENDED' } });
    expect((await open(customer.token, suspended.masterId)).status).toBe(404);

    const admin = await createAdmin(h);
    expect((await open(admin.token, master.masterId)).status).toBe(403);
    expect((await open(undefined, master.masterId)).status).toBe(401);
  });

  it('a pre-order DIRECT chat becomes the order chat — booking never opens a second conversation (history is kept)', async () => {
    const buyer = await createUser(h, ['CUSTOMER']);
    const target = await createMaster(h, service.id);
    const direct = (await open(buyer.token, target.masterId)).data;
    expect(direct.type).toBe('DIRECT');
    expect((await h.post(`/conversations/${direct.id}/messages`, buyer.token, { text: 'Salom, ustoz' })).status).toBe(201);

    const order = await bookOrder(h, buyer, target, service.id);
    const mine = await h.db.conversation.findMany({ where: { participants: { some: { userId: buyer.id } } } });
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ id: direct.id, type: 'ORDER', orderId: order.orderId });
    const thread = await h.get(`/conversations/${direct.id}/messages`, target.token);
    expect(thread.data.items.map((m: { text: string }) => m.text)).toContain('Salom, ustoz');

    // Ikkinchi buyurtma ham xuddi shu suhbatga bog‘lanadi; buyurtma sahifasi suhbat ID sini topadi.
    const second = await bookOrder(h, buyer, target, service.id);
    expect(await h.db.conversation.count({ where: { participants: { some: { userId: buyer.id } } } })).toBe(1);
    const view = await h.get(`/orders/${order.orderId}`, buyer.token);
    expect(view.data.conversationId).toBe(direct.id);
    expect((await h.get(`/orders/${second.orderId}`, buyer.token)).data.conversationId).toBe(direct.id);
    expect((await open(buyer.token, target.masterId)).data.id).toBe(direct.id);
  });

  it('reuses an existing order conversation instead of opening a second, empty chat with the same master', async () => {
    const buyer = await createUser(h, ['CUSTOMER']);
    const target = await createMaster(h, service.id);
    const order = await bookOrder(h, buyer, target, service.id);
    const orderChat = await h.db.conversation.findUniqueOrThrow({ where: { orderId: order.orderId } });

    const opened = await open(buyer.token, target.masterId);
    expect(opened.status).toBe(201);
    expect(opened.data.id).toBe(orderChat.id);
    expect(opened.data.type).toBe('ORDER');
    expect(await h.db.conversation.count({ where: { participants: { some: { userId: buyer.id } } } })).toBe(1);
  });

  it('a cancelled order never forces a second chat: the same conversation reopens for writing', async () => {
    const buyer = await createUser(h, ['CUSTOMER']);
    const target = await createMaster(h, service.id);
    const order = await bookOrder(h, buyer, target, service.id);
    const orderChat = await h.db.conversation.findUniqueOrThrow({ where: { orderId: order.orderId } });
    await h.db.order.update({ where: { id: order.orderId }, data: { status: 'CANCELLED' } });
    expect((await h.post(`/conversations/${orderChat.id}/messages`, buyer.token, { text: 'yopiq' })).status).toBe(409);

    const opened = await open(buyer.token, target.masterId);
    expect(opened.status).toBe(201);
    expect(opened.data.id).toBe(orderChat.id);
    expect(opened.data.type).toBe('DIRECT');
    expect(await h.db.conversation.count({ where: { participants: { some: { userId: buyer.id } } } })).toBe(1);
    expect((await h.post(`/conversations/${orderChat.id}/messages`, buyer.token, { text: 'qayta ochildi' })).status).toBe(201);
  });
});
