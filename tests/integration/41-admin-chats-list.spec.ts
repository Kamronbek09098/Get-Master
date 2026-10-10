import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookOrder, bootHarness, createAdmin, createMaster, createSuperAdmin, createUser, firstService, type Harness, type TestMaster, type TestUser } from '../helpers/harness';

let h: Harness;
let superAdmin: TestUser;
let noChats: TestUser;
let customer: TestUser;
let master: TestMaster;
let conversationId: string;
let orderId: string;

beforeAll(async () => {
  h = await bootHarness();
  superAdmin = await createSuperAdmin(h);
  noChats = await createAdmin(h, ['USERS']);
  customer = await createUser(h, ['CUSTOMER']);
  const serviceId = (await firstService(h)).id;
  master = await createMaster(h, serviceId);
  const order = await bookOrder(h, customer, master, serviceId, { price: 130000 });
  orderId = order.orderId;
  const conv = await h.db.conversation.findFirstOrThrow({ where: { orderId } });
  conversationId = conv.id;
  const message = await h.db.message.create({ data: { conversationId, senderId: customer.id, senderPanel: 'CUSTOMER', type: 'TEXT', text: 'Salom, test xabari' } });
  await h.db.message.create({ data: { conversationId, senderId: master.id, senderPanel: 'MASTER', type: 'TEXT', text: 'Yashirin xabar', deletedAt: new Date() } });
  await h.db.messageEdit.create({ data: { messageId: message.id, previousText: 'Eski matn' } });
  await h.db.message.create({ data: { conversationId, senderId: master.id, senderPanel: 'MASTER', type: 'TEXT', attachments: [{ mediaAssetId: '11111111-1111-4111-8111-111111111111', mimeType: 'image/jpeg', name: 'a.jpg' }] } });
});
afterAll(async () => {
  await h.close();
});

describe('admin conversations', () => {
  it('are permission-gated and reject unknown filters', async () => {
    for (const path of ['/admin/conversations', '/admin/conversations/stats', `/admin/conversations/${'11111111-1111-4111-8111-111111111111'}/files`]) expect((await h.get(path, noChats.token)).status, path).toBe(403);
    expect((await h.get('/admin/conversations?flag=weird', superAdmin.token)).status).toBe(400);
    expect((await h.get('/admin/conversations?sort=password', superAdmin.token)).status).toBe(400);
    expect((await h.get('/admin/conversations/11111111-1111-4111-8111-111111111111/timeline', superAdmin.token)).status).toBe(404);
  });

  it('lists with order info, flags and filters, and stats agree with the list', async () => {
    const byOrder = await h.get(`/admin/conversations?search=${customer.phone.slice(-9)}`, superAdmin.token);
    expect(byOrder.status).toBe(200);
    const row = byOrder.data.items.find((c: { id: string }) => c.id === conversationId);
    expect(row.order).toEqual(expect.objectContaining({ orderNumber: expect.any(Number), status: 'BOOKED', casesCount: 0 }));
    expect(row.deletedCount).toBe(1);
    expect(row.editedCount).toBe(1);
    expect(row.messageCount).toBe(3);
    const deleted = await h.get('/admin/conversations?flag=deleted', superAdmin.token);
    expect(deleted.data.items.map((c: { id: string }) => c.id)).toContain(conversationId);
    const files = await h.get('/admin/conversations?flag=files', superAdmin.token);
    expect(files.data.items.map((c: { id: string }) => c.id)).toContain(conversationId);
    const status = await h.get('/admin/conversations?orderStatus=COMPLETED', superAdmin.token);
    expect(status.data.items.map((c: { id: string }) => c.id)).not.toContain(conversationId);
    const num = await h.get(`/admin/conversations?search=${row.order.orderNumber}`, superAdmin.token);
    expect(num.data.items.map((c: { id: string }) => c.id)).toContain(conversationId);
    const stats = await h.get('/admin/conversations/stats', superAdmin.token);
    expect(stats.data.order).toBeGreaterThanOrEqual(1);
    expect(stats.data.withDeleted).toBeGreaterThanOrEqual(1);
    const sorted = await h.get('/admin/conversations?sort=messages&limit=5', superAdmin.token);
    const counts = sorted.data.items.map((c: { messageCount: number }) => c.messageCount);
    expect(counts).toEqual([...counts].sort((a: number, b: number) => b - a));
  });

  it('returns details, files and a timeline for one conversation', async () => {
    const detail = await h.get(`/admin/conversations/${conversationId}`, superAdmin.token);
    expect(detail.data.order).toEqual(expect.objectContaining({ id: orderId, cases: [], payment: null }));
    expect(detail.data.participants).toHaveLength(2);
    expect(detail.data.participants[0].user).toEqual(expect.objectContaining({ phone: expect.any(String) }));
    const files = await h.get(`/admin/conversations/${conversationId}/files`, superAdmin.token);
    expect(files.data.items).toHaveLength(1);
    expect(files.data.items[0]).toEqual(expect.objectContaining({ name: 'a.jpg', mimeType: 'image/jpeg' }));
    const timeline = await h.get(`/admin/conversations/${conversationId}/timeline`, superAdmin.token);
    const kinds = timeline.data.items.map((e: { kind: string }) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(['created', 'first_message', 'edited', 'order_status']));
    const times = timeline.data.items.map((e: { at: string }) => Date.parse(e.at));
    expect(times).toEqual([...times].sort((a: number, b: number) => b - a));
  });
});
