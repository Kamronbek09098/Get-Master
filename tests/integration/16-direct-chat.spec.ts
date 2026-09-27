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

  it('does not disturb order chats: an order conversation is still a separate ORDER conversation', async () => {
    const direct = (await open(customer.token, master.masterId)).data;
    expect(direct.type).toBe('DIRECT');
    const orderChats = await h.db.conversation.count({ where: { type: 'ORDER', participants: { some: { userId: customer.id } } } });
    expect(orderChats).toBe(0);
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

  it('falls back to a fresh DIRECT conversation when the only existing chat is a read-only (cancelled) order', async () => {
    const buyer = await createUser(h, ['CUSTOMER']);
    const target = await createMaster(h, service.id);
    const order = await bookOrder(h, buyer, target, service.id);
    await h.db.order.update({ where: { id: order.orderId }, data: { status: 'CANCELLED' } });

    const opened = await open(buyer.token, target.masterId);
    expect(opened.status).toBe(201);
    expect(opened.data.type).toBe('DIRECT');
    expect(await h.db.conversation.count({ where: { participants: { some: { userId: buyer.id } } } })).toBe(2);
  });
});

describe('conversations are scoped to the panel role that holds them', () => {
  const asPanel = (token: string | undefined, panel: string) => ({
    cookie: `accessToken_${panel.toLowerCase()}=${token}`,
    headers: { 'x-app-panel': panel },
  });
  const ids = (res: { data: { items: Array<{ id: string }> } }) => res.data.items.map((item) => item.id);

  it('shows a customer-side chat only in the customer panel and a master-side chat only in the master panel', async () => {
    const buyer = await createMaster(h, service.id);
    const target = await createMaster(h, service.id);
    const created = await open(buyer.token, target.masterId);
    const id = created.data.id as string;
    expect(created.data.participants.find((p: { userId: string }) => p.userId === buyer.id).roles).toEqual(['CUSTOMER']);

    const list = (token: string | undefined, panel: string) => h.api('GET', '/conversations?limit=100', asPanel(token, panel));
    expect(ids(await list(buyer.token, 'CUSTOMER'))).toContain(id);
    expect(ids(await list(buyer.token, 'MASTER'))).not.toContain(id);
    expect(ids(await list(target.token, 'MASTER'))).toContain(id);
    expect(ids(await list(target.token, 'CUSTOMER'))).not.toContain(id);

    expect((await h.api('GET', `/conversations/${id}/messages`, asPanel(buyer.token, 'MASTER'))).status).toBe(403);
    expect((await h.api('POST', `/conversations/${id}/messages`, { ...asPanel(buyer.token, 'MASTER'), body: { text: 'salom' } })).status).toBe(403);
    expect((await h.api('POST', `/conversations/${id}/messages`, { ...asPanel(buyer.token, 'CUSTOMER'), body: { text: 'salom' } })).status).toBe(201);
  });
});

describe('admin sees every conversation, including deleted and edited messages', () => {
  it('returns original texts, deletion marks and the edit history', async () => {
    const admin = await createAdmin(h);
    const buyer = await createUser(h, ['CUSTOMER']);
    const target = await createMaster(h, service.id);
    const conversation = (await open(buyer.token, target.masterId)).data.id as string;
    const send = (text: string) =>
      h.api('POST', `/conversations/${conversation}/messages`, { cookie: `accessToken_customer=${buyer.token}`, headers: { 'x-app-panel': 'CUSTOMER' }, body: { text } });
    const kept = (await send('birinchi')).data;
    const removed = (await send('maxfiy matn')).data;
    const as = { cookie: `accessToken_customer=${buyer.token}`, headers: { 'x-app-panel': 'CUSTOMER' } };
    expect((await h.api('PATCH', `/conversations/${conversation}/messages/${kept.id}`, { ...as, body: { text: 'yangi matn' } })).status).toBe(200);
    expect((await h.api('DELETE', `/conversations/${conversation}/messages/${removed.id}`, as)).status).toBe(200);

    expect((await h.get(`/admin/conversations/${conversation}/messages`, buyer.token)).status).toBe(403);
    const list = await h.get(`/admin/conversations?limit=100`, admin.token);
    const row = list.data.items.find((c: { id: string }) => c.id === conversation);
    expect(row).toMatchObject({ messageCount: 2, deletedCount: 1, editedCount: 1 });

    const messages = (await h.get(`/admin/conversations/${conversation}/messages`, admin.token)).data.items as any[];
    const deleted = messages.find((m) => m.id === removed.id);
    expect(deleted).toMatchObject({ text: 'maxfiy matn' });
    expect(deleted.deletedAt).toBeTruthy();
    const edited = messages.find((m) => m.id === kept.id);
    expect(edited.text).toBe('yangi matn');
    expect(edited.edits.map((e: { previousText: string }) => e.previousText)).toEqual(['birinchi']);

    const audit = await h.get(`/audit-logs?actorId=${buyer.id}&limit=50`, admin.token);
    expect(audit.data.items.map((a: { action: string }) => a.action)).toEqual(expect.arrayContaining(['CHAT_MESSAGE_EDITED', 'CHAT_MESSAGE_DELETED']));
  });
});

describe('Telegram-style features: reply, reactions and attachments', () => {
  it('replies to a message of the same chat only, and masks a deleted quote', async () => {
    const buyer = await createUser(h, ['CUSTOMER']);
    const target = await createMaster(h, service.id);
    const other = await createMaster(h, service.id);
    const chat = (await open(buyer.token, target.masterId)).data.id as string;
    const otherChat = (await open(buyer.token, other.masterId)).data.id as string;
    const as = { cookie: `accessToken_customer=${buyer.token}`, headers: { 'x-app-panel': 'CUSTOMER' } };
    const send = (id: string, body: object) => h.api('POST', `/conversations/${id}/messages`, { ...as, body });

    const first = (await send(chat, { text: 'asl xabar' })).data;
    const foreign = (await send(otherChat, { text: 'boshqa suhbat' })).data;
    const reply = await send(chat, { text: 'javob', replyToId: first.id });
    expect(reply.status).toBe(201);
    expect(reply.data.replyTo).toMatchObject({ id: first.id, text: 'asl xabar' });
    expect((await send(chat, { text: 'x', replyToId: foreign.id })).status).toBe(400);

    expect((await h.api('DELETE', `/conversations/${chat}/messages/${first.id}`, as)).status).toBe(200);
    const list = (await h.api('GET', `/conversations/${chat}/messages`, as)).data.items as any[];
    expect(list.find((m) => m.id === reply.data.id).replyTo.text).toBeNull();
  });

  it('keeps one reaction per person and panel, replaces it and removes it', async () => {
    const buyer = await createUser(h, ['CUSTOMER']);
    const target = await createMaster(h, service.id);
    const chat = (await open(buyer.token, target.masterId)).data.id as string;
    const asBuyer = { cookie: `accessToken_customer=${buyer.token}`, headers: { 'x-app-panel': 'CUSTOMER' } };
    const asMaster = { cookie: `accessToken_master=${target.token}`, headers: { 'x-app-panel': 'MASTER' } };
    const message = (await h.api('POST', `/conversations/${chat}/messages`, { ...asBuyer, body: { text: 'salom' } })).data;
    const react = (as: object, emoji: string | null) => h.api('PUT', `/conversations/${chat}/messages/${message.id}/reaction`, { ...as, body: { emoji } });

    expect((await react(asMaster, '❤️')).data.reactions).toHaveLength(1);
    expect((await react(asBuyer, '👍')).data.reactions).toHaveLength(2);
    const changed = (await react(asMaster, '🔥')).data.reactions as Array<{ emoji: string }>;
    expect(changed.map((r) => r.emoji).sort()).toEqual(['👍', '🔥'].sort());
    expect((await react(asMaster, null)).data.reactions).toHaveLength(1);
    expect((await react(asMaster, '💩')).status).toBe(400);
  });

  it('sends a photo attachment together with a text', async () => {
    const buyer = await createMaster(h, service.id);
    const target = await createMaster(h, service.id);
    const chat = (await open(buyer.token, target.masterId)).data.id as string;
    const asset = await uploadImage(h, buyer.token, 'MESSAGE_ATTACHMENT', 'Conversation', chat, 120);
    const sent = await h.api('POST', `/conversations/${chat}/messages`, {
      cookie: `accessToken_customer=${buyer.token}`,
      headers: { 'x-app-panel': 'CUSTOMER' },
      body: { text: 'rasm', mediaAssetIds: [asset] },
    });
    expect(sent.status).toBe(201);
    expect(sent.data.type).toBe('IMAGE');
    expect(sent.data.attachments[0].mediaAssetId).toBe(asset);
    const as = { cookie: `accessToken_customer=${buyer.token}`, headers: { 'x-app-panel': 'CUSTOMER' } };
    const caption = await h.api('PATCH', `/conversations/${chat}/messages/${sent.data.id}`, { ...as, body: { text: 'yangi izoh' } });
    expect(caption.status).toBe(200);
    expect(caption.data).toMatchObject({ text: 'yangi izoh', type: 'IMAGE' });
    expect(caption.data.editedAt).toBeTruthy();
  });
});
