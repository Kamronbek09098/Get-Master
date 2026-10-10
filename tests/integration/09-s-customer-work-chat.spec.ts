import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookOrder, bootHarness, createMaster, createUser, firstService, type Harness, MISSING_UUID, payOrder, type TestMaster, type TestUser, uploadImage, waitFor, soon } from '../helpers/harness';

let h: Harness;
let service: { id: string };
let customer: TestUser;
let stranger: TestUser;
let master: TestMaster;

beforeAll(async () => {
  h = await bootHarness();
  service = await firstService(h);
  customer = await createUser(h, ['CUSTOMER']);
  stranger = await createUser(h, ['CUSTOMER']);
  master = await createMaster(h, service.id);
});
afterAll(async () => {
  await h.close();
});

describe('S06 — customer addresses', () => {
  it('first address is the default; making another default demotes the rest; deleting the default promotes one', async () => {
    const c = await createUser(h, ['CUSTOMER']);
    const home = await h.post('/customers/me/addresses', c.token, { title: 'Home', addressLine: 'Chilonzor 5', latitude: 41.28, longitude: 69.2 });
    expect(home.data.isDefault).toBe(true);
    const work = await h.post('/customers/me/addresses', c.token, { title: 'Work', addressLine: 'Amir Temur 1', isDefault: true });
    expect(work.data.isDefault).toBe(true);
    const list = (await h.get('/customers/me/addresses', c.token)).data;
    expect(list.filter((a: any) => a.isDefault)).toHaveLength(1);
    expect(list[0].id).toBe(work.data.id);
    expect((await h.patch(`/customers/me/addresses/${work.data.id}`, c.token, { isDefault: false })).data.isDefault).toBe(true);
    expect((await h.del(`/customers/me/addresses/${work.data.id}`, c.token)).status).toBe(200);
    const after = (await h.get('/customers/me/addresses', c.token)).data;
    expect(after).toHaveLength(1);
    expect(after[0].isDefault).toBe(true);
  });

  it('concurrent default creations never leave two defaults', async () => {
    const c = await createUser(h, ['CUSTOMER']);
    await Promise.all(Array.from({ length: 6 }, (_, i) => h.post('/customers/me/addresses', c.token, { addressLine: `Line ${i}`, isDefault: true })));
    const rows = await h.db.address.findMany({ where: { userId: c.id } });
    expect(rows).toHaveLength(6);
    expect(rows.filter((a) => a.isDefault)).toHaveLength(1);
  });

  it('is ownership-scoped and validated', async () => {
    const c = await createUser(h, ['CUSTOMER']);
    const mine = await h.post('/customers/me/addresses', c.token, { addressLine: 'Mine 1' });
    expect((await h.patch(`/customers/me/addresses/${mine.data.id}`, stranger.token, { addressLine: 'stolen' })).status).toBe(404);
    expect((await h.del(`/customers/me/addresses/${mine.data.id}`, stranger.token)).status).toBe(404);
    expect((await h.get('/customers/me/addresses', stranger.token)).data.every((a: any) => a.userId === stranger.id)).toBe(true);
    for (const bad of [{}, { addressLine: '' }, { addressLine: 'x', latitude: 91 }, { addressLine: 'x', longitude: -181 }, { addressLine: 'x', userId: stranger.id }, { addressLine: 'x'.repeat(501) }]) {
      expect((await h.post('/customers/me/addresses', c.token, bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await h.patch(`/customers/me/addresses/${MISSING_UUID}`, c.token, { city: 'x' })).status).toBe(404);
    const res = await h.post('/problem-requests', stranger.token, { preferredStartAt: soon(), title: 'Steal address', description: 'uses foreign address id', addressId: mine.data.id });
    expect(res.status).toBe(403);
  });
});

describe('S07 — work lifecycle, proofs, timeline', () => {
  it('proofs are stage-gated, ownership-checked, backed by real READY media, and removable only while their stage is open', async () => {
    const c = await createUser(h, ['CUSTOMER']);
    const order = await bookOrder(h, c, master, service.id);
    const O = `/orders/${order.orderId}`;
    const rival = await createMaster(h, service.id);

    expect((await h.post(`${O}/confirm`, c.token)).status).toBe(403);
    expect((await h.post(`${O}/confirm`, rival.token)).status).toBe(403);
    expect((await h.post(`${O}/arrive`, master.token)).status).toBe(409);
    expect((await h.post(`${O}/confirm`, master.token)).status).toBe(201);
    expect((await h.post(`${O}/confirm`, master.token)).status).toBe(409);
    await h.post(`${O}/start-travel`, master.token);
    await h.post(`${O}/arrive`, master.token, { latitude: 41.311, longitude: 69.279, accuracy: 5 });

    const rivalUpload = new FormData();
    rivalUpload.set('kind', 'WORK_PROOF'); rivalUpload.set('linkType', 'Order'); rivalUpload.set('linkId', order.orderId);
    rivalUpload.set('file', new Blob([new Uint8Array(10)], { type: 'image/png' }), 'x.png');
    expect((await h.api('POST', '/media/uploads', { token: rival.token, form: rivalUpload })).status).toBe(403);
    const before = await uploadImage(h, master.token, 'WORK_PROOF', 'Order', order.orderId, 90);
    expect((await h.post(`${O}/work-proofs`, master.token, { stage: 'AFTER', mediaAssetId: before })).status).toBe(403);
    expect((await h.post(`${O}/work-proofs`, rival.token, { stage: 'BEFORE', mediaAssetId: before })).status).toBe(403);
    expect((await h.post(`${O}/work-proofs`, c.token, { stage: 'BEFORE', mediaAssetId: before })).status).toBe(403);
    expect((await h.post(`${O}/work-proofs`, master.token, { stage: 'BEFORE', mediaAssetId: MISSING_UUID })).status).toBe(403);
    expect((await h.post(`${O}/work-proofs`, master.token, { stage: 'BEFORE', storageKey: 'media/x/original' })).status).toBe(400);
    expect((await h.post(`${O}/start-work`, master.token)).status).toBe(403);

    const proof = await h.post(`${O}/work-proofs`, master.token, { stage: 'BEFORE', mediaAssetId: before });
    expect(proof.status).toBe(201);
    expect((await h.post(`${O}/work-proofs`, master.token, { stage: 'BEFORE', mediaAssetId: before })).status).toBe(409);
    expect(JSON.stringify((await h.get(`${O}/work-proofs`, c.token)).body)).not.toMatch(/storageKey/);
    expect((await h.get(`${O}/work-proofs`, stranger.token)).status).toBe(403);
    expect((await h.del(`${O}/work-proofs/${proof.data.id}`, c.token)).status).toBe(403);
    expect((await h.del(`${O}/work-proofs/${MISSING_UUID}`, master.token)).status).toBe(404);

    expect((await h.del(`${O}/work-proofs/${proof.data.id}`, master.token)).status).toBe(200);
    expect((await h.post(`${O}/start-work`, master.token)).status).toBe(403);
    const again = await h.post(`${O}/work-proofs`, master.token, { stage: 'BEFORE', mediaAssetId: before });
    expect(again.status).toBe(201);
    expect((await h.post(`${O}/start-work`, master.token)).status).toBe(201);
    expect((await h.del(`${O}/work-proofs/${again.data.id}`, master.token)).status).toBe(403);
    expect((await h.post(`${O}/submit-completion`, master.token)).status).toBe(403);

    const after = await uploadImage(h, master.token, 'WORK_PROOF', 'Order', order.orderId, 91);
    expect((await h.post(`${O}/work-proofs`, master.token, { stage: 'AFTER', mediaAssetId: after })).status).toBe(201);
    expect((await h.post(`${O}/confirm-completion`, c.token)).status).toBe(409);
    expect((await h.post(`${O}/submit-completion`, master.token)).status).toBe(201);
    expect((await h.post(`${O}/confirm-completion`, master.token)).status).toBe(403);
    // To'lov amalga oshmaguncha tasdiqlab bo'lmaydi; naqd to'lov usulini faqat tanlash ham yetarli emas.
    const unpaid = await h.post(`${O}/confirm-completion`, c.token);
    expect(unpaid.status).toBe(409);
    expect(unpaid.body.code).toBe('PAYMENT_REQUIRED');
    expect((await h.post('/payments', c.token, { orderId: order.orderId, provider: 'CASH' }, { idempotent: true })).status).toBe(201);
    expect((await h.post(`${O}/confirm-completion`, c.token)).status).toBe(409);
    await payOrder(h, c, order.orderId);
    expect((await h.post(`${O}/confirm-completion`, c.token)).status).toBe(201);
    expect((await h.post(`${O}/cancel`, c.token, { reason: 'too late' })).status).toBe(409);

    const timeline = (await h.get(`${O}/timeline`, c.token)).data;
    expect(timeline.map((t: any) => t.newStatus)).toEqual(['BOOKED', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'WAITING_CONFIRMATION', 'COMPLETED']);
    expect(timeline.map((t: any) => t.actorType)).toEqual(['CUSTOMER', 'MASTER', 'MASTER', 'MASTER', 'MASTER', 'MASTER', 'CUSTOMER']);
    expect((await h.get(`${O}/timeline`, stranger.token)).status).toBe(403);
    expect((await h.get(`/orders/${MISSING_UUID}/timeline`, c.token)).status).toBe(404);
  });

  it('cancellation and dispute are participant-only, need a reason, and are terminal/exclusive', async () => {
    const c = await createUser(h, ['CUSTOMER']);
    const order = await bookOrder(h, c, master, service.id);
    const O = `/orders/${order.orderId}`;
    expect((await h.post(`${O}/cancel`, stranger.token, { reason: 'x' })).status).toBe(403);
    expect((await h.post(`${O}/cancel`, c.token, {})).status).toBe(400);
    expect((await h.post(`${O}/cancel`, c.token, { reason: 'Changed plans' })).data.status).toBe('CANCELLED');
    expect((await h.post(`${O}/cancel`, master.token, { reason: 'again' })).status).toBe(409);
    expect((await h.post(`${O}/confirm`, master.token)).status).toBe(409);
  });
});

describe('S08 — chat', () => {
  let c: TestUser;
  let orderId: string;
  let conversationId: string;

  beforeAll(async () => {
    c = await createUser(h, ['CUSTOMER'], { firstName: 'Chatty' });
    orderId = (await bookOrder(h, c, master, service.id)).orderId;
    conversationId = (await h.db.conversation.findUniqueOrThrow({ where: { orderId } })).id;
  });

  it('only the two parties can open/read/write; outsiders get 403 everywhere', async () => {
    const C = `/conversations/${conversationId}`;
    expect((await h.post('/conversations', stranger.token, { orderId })).status).toBe(403);
    expect((await h.get(C, stranger.token)).status).toBe(403);
    expect((await h.get(`${C}/messages`, stranger.token)).status).toBe(403);
    expect((await h.post(`${C}/messages`, stranger.token, { text: 'hi' })).status).toBe(403);
    expect((await h.post(`${C}/read`, stranger.token)).status).toBe(403);
    expect((await h.get(C, c.token)).status).toBe(200);
    expect((await h.get(C, master.token)).status).toBe(200);
    expect((await h.get(`/conversations/${MISSING_UUID}`, c.token)).status).toBe(404);
    expect((await h.get('/conversations', stranger.token)).data.items).toEqual([]);
    expect((await h.post('/conversations', c.token, { orderId })).data.id).toBe(conversationId);
    expect(await h.db.conversation.count({ where: { orderId } })).toBe(1);
  });

  it('a legacy order without a chat gets exactly one, even when opened concurrently', async () => {
    // Yangi juftlik (mijoz + boshqa usta): yagona-suhbat qoidasi tufayli mavjud juftlik suhbati qayta ishlatilmasligi uchun.
    const otherMaster = await createMaster(h, service.id, { firstName: 'Legacy' });
    const legacy = await bookOrder(h, c, otherMaster, service.id);
    await h.db.conversation.delete({ where: { orderId: legacy.orderId } });
    const results = await Promise.all(Array.from({ length: 5 }, () => h.post('/conversations', c.token, { orderId: legacy.orderId })));
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(new Set(results.map((r) => r.data.id)).size).toBe(1);
    expect(await h.db.conversation.count({ where: { orderId: legacy.orderId } })).toBe(1);
  });

  it('validates messages, tracks unread state and notifies the other side', async () => {
    const C = `/conversations/${conversationId}`;
    for (const bad of [{}, { text: '' }, { text: '   ' }, { text: 'x'.repeat(2001) }, { text: 'ok', senderId: master.id }, { mediaAssetIds: ['nope'] }, { mediaAssetIds: Array(6).fill(MISSING_UUID) }]) {
      expect((await h.post(`${C}/messages`, c.token, bad)).status, JSON.stringify(bad).slice(0, 60)).toBe(400);
    }
    const sent = await h.post(`${C}/messages`, c.token, { text: '  Salom, qachon kelasiz?  ' });
    expect(sent.status).toBe(201);
    expect(sent.data.text).toBe('Salom, qachon kelasiz?');
    expect(sent.data.senderId).toBe(c.id);

    const listed = (await h.get('/conversations', master.token)).data.items.find((x: any) => x.id === conversationId);
    expect(listed.unreadCount).toBe(1);
    expect(listed.lastMessage.text).toBe('Salom, qachon kelasiz?');
    expect(listed.counterpart.firstName).toBe('Chatty');
    expect(JSON.stringify(listed)).not.toContain(c.phone);
    const note = await waitFor(async () => h.db.notification.findFirst({ where: { userId: master.id, template: 'chat.message' } }), { label: 'chat notification' });
    expect(note.body).not.toContain('qachon kelasiz');
    expect((await h.post(`${C}/read`, master.token)).status).toBe(201);
    expect((await h.get('/conversations', master.token)).data.items.find((x: any) => x.id === conversationId).unreadCount).toBe(0);
  });

  it('edit/delete: author only, text only, 48-hour edit window; delete removes the message for everyone (Telegram-style), edits keep their history', async () => {
    const C = `/conversations/${conversationId}`;
    const m1 = (await h.post(`${C}/messages`, c.token, { text: 'first' })).data;
    expect((await h.patch(`${C}/messages/${m1.id}`, master.token, { text: 'forged' })).status).toBe(403);
    expect((await h.del(`${C}/messages/${m1.id}`, master.token)).status).toBe(403);
    expect((await h.patch(`${C}/messages/${m1.id}`, c.token, { text: 'edited' })).data.editedAt).toBeTruthy();
    expect((await h.patch(`${C}/messages/${m1.id}`, c.token, { text: '' })).status).toBe(400);
    await h.db.message.update({ where: { id: m1.id }, data: { createdAt: new Date(Date.now() - 49 * 3_600_000) } });
    expect((await h.patch(`${C}/messages/${m1.id}`, c.token, { text: 'too late' })).status).toBe(409);
    const editRows = await h.db.messageEdit.findMany({ where: { messageId: m1.id } });
    expect(editRows).toHaveLength(1);
    expect(await h.db.auditLog.count({ where: { action: 'CHAT_MESSAGE_EDITED', targetId: m1.id } })).toBe(1);
    expect((await h.del(`${C}/messages/${m1.id}`, c.token)).status).toBe(200);
    // «Hamma uchun o‘chirish»: xabar butunlay o‘chadi, qayta o‘chirib bo‘lmaydi va suhbat tarixida ko‘rinmaydi.
    expect(await h.db.message.count({ where: { id: m1.id } })).toBe(0);
    expect((await h.del(`${C}/messages/${m1.id}`, c.token)).status).toBe(404);
    const history = (await h.get(`${C}/messages?limit=50`, master.token)).data.items.find((x: any) => x.id === m1.id);
    expect(history).toBeUndefined();
    expect((await h.patch(`${C}/messages/${MISSING_UUID}`, c.token, { text: 'x' })).status).toBe(404);
  });

  it('attachments: only the sender’s own READY uploads to this conversation; signed URLs follow conversation membership', async () => {
    const C = `/conversations/${conversationId}`;
    const asset = await uploadImage(h, c.token, 'MESSAGE_ATTACHMENT', 'Conversation', conversationId, 95);
    const form = new FormData();
    form.set('kind', 'MESSAGE_ATTACHMENT'); form.set('linkType', 'Conversation'); form.set('linkId', conversationId);
    form.set('file', new Blob([new Uint8Array(10)], { type: 'image/png' }), 'x.png');
    expect((await h.api('POST', '/media/uploads', { token: stranger.token, form })).status).toBe(403);

    expect((await h.post(`${C}/messages`, master.token, { mediaAssetIds: [asset] })).status).toBe(403);
    expect((await h.post(`${C}/messages`, c.token, { mediaAssetIds: [MISSING_UUID] })).status).toBe(403);
    const msg = await h.post(`${C}/messages`, c.token, { text: 'photo', mediaAssetIds: [asset] });
    expect(msg.status).toBe(201);
    expect(msg.data.type).toBe('IMAGE');
    expect(msg.data.attachments[0].mediaAssetId).toBe(asset);

    expect((await h.get(`/media/${asset}/thumbnail`, master.token)).status).toBe(200);
    expect((await h.get(`/media/${asset}/thumbnail`, c.token)).status).toBe(200);
    expect((await h.get(`/media/${asset}/thumbnail`, stranger.token)).status).toBe(403);
    expect((await h.get(`/media/${asset}`, stranger.token)).status).toBe(403);
  });

  it('cursor pagination walks the whole history without gaps or duplicates', async () => {
    const fresh = await createUser(h, ['CUSTOMER']);
    const o = (await bookOrder(h, fresh, master, service.id)).orderId;
    const conv = (await h.db.conversation.findUniqueOrThrow({ where: { orderId: o } })).id;
    const sent: string[] = [];
    for (let i = 0; i < 7; i += 1) sent.push((await h.post(`/conversations/${conv}/messages`, i % 2 ? master.token : fresh.token, { text: `m${i}` })).data.id);
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: any = await h.get(`/conversations/${conv}/messages?limit=3${cursor ? `&cursor=${cursor}` : ''}`, fresh.token);
      seen.push(...page.data.items.map((m: any) => m.id));
      cursor = page.data.nextCursor;
    } while (cursor);
    expect(seen).toEqual([...sent].reverse());
    expect((await h.get(`/conversations/${conv}/messages?limit=500`, fresh.token)).status).toBe(400);
  });

  it('a cancelled order makes the chat read-only (history stays readable)', async () => {
    const buyer = await createUser(h, ['CUSTOMER']);
    const o = (await bookOrder(h, buyer, master, service.id)).orderId;
    const conv = (await h.db.conversation.findUniqueOrThrow({ where: { orderId: o } })).id;
    await h.post(`/conversations/${conv}/messages`, buyer.token, { text: 'before cancel' });
    await h.post(`/orders/${o}/cancel`, buyer.token, { reason: 'plans changed' });
    const blocked = await h.post(`/conversations/${conv}/messages`, buyer.token, { text: 'after cancel' });
    expect(blocked.status).toBe(409);
    expect((await h.post(`/conversations/${conv}/messages`, master.token, { text: 'after cancel' })).status).toBe(409);
    expect((await h.get(`/conversations/${conv}/messages`, buyer.token)).data.items).toHaveLength(1);
  });

  it('rate limit is identity-aware: per user + endpoint, not per IP', async () => {
    const spammer = await createUser(h, ['CUSTOMER']);
    const bystander = await createUser(h, ['CUSTOMER']);
    const so = (await bookOrder(h, spammer, master, service.id)).orderId;
    const bo = (await bookOrder(h, bystander, master, service.id)).orderId;
    const sConv = (await h.db.conversation.findUniqueOrThrow({ where: { orderId: so } })).id;
    const bConv = (await h.db.conversation.findUniqueOrThrow({ where: { orderId: bo } })).id;
    const send = (token: string, conv: string, ip: string) => h.api('POST', `/conversations/${conv}/messages`, { token, ip, body: { text: 'ping' } });

    const ip = '10.9.9.9';
    const statuses: number[] = [];
    for (let i = 0; i < 32; i += 1) statuses.push((await send(spammer.token, sConv, ip)).status);
    expect(statuses.slice(0, 30).every((s) => s === 201)).toBe(true);
    expect(statuses.slice(30)).toEqual([429, 429]);

    expect((await send(bystander.token, bConv, ip)).status).toBe(201);
    expect((await send(spammer.token, sConv, '10.9.9.10')).status).toBe(429);
    expect((await h.api('GET', `/conversations/${sConv}/messages`, { token: spammer.token, ip })).status).toBe(200);
  });
});
