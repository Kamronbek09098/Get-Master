import { createHash, createHmac, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createAdmin, createMaster, createSuperAdmin, createUser, firstService, uploadImage, type Harness, type TestMaster, type TestUser, soon } from '../helpers/harness';

let h: Harness;
let customer: TestUser;
let peer: TestUser;
let master: TestMaster;
let admin: TestUser;
let ip = 0;
const asIp = () => `10.24.0.${++ip}`;

beforeAll(async () => {
  process.env.RATE_LIMIT_CALL_MAX = '200';
  Object.assign(process.env, { CLICK_MERCHANT_ID: 'm1', CLICK_SERVICE_ID: 's1', CLICK_SECRET_KEY: 'test-only-click-webhook-secret', PAYME_MERCHANT_ID: 'pm1', PAYME_SECRET_KEY: 'test-only-payme-secret', UZUM_MERCHANT_ID: 'um1', UZUM_SECRET_KEY: 'test-only-uzum-secret' });
  h = await bootHarness();
  const service = await firstService(h);
  customer = await createUser(h);
  peer = await createUser(h);
  master = await createMaster(h, service.id);
  admin = await createSuperAdmin(h);
});
afterAll(async () => {
  await h.close();
  for (const key of ['RATE_LIMIT_CALL_MAX', 'CLICK_MERCHANT_ID', 'CLICK_SERVICE_ID', 'PAYME_MERCHANT_ID', 'PAYME_SECRET_KEY', 'UZUM_MERCHANT_ID', 'UZUM_SECRET_KEY']) delete process.env[key];
});

const req = (token: string, body: Record<string, unknown>) => h.api('POST', '/subscriptions/requests', { token, body, ip: asIp() });
const md5 = (parts: (string | number)[]) => createHash('md5').update(parts.join('')).digest('hex');

/** Karta cheki: fayl yuklanadi va so‘rovga biriktiriladi. */
async function uploadReceiptAs(user: TestUser, subscriptionId: string) {
  // Begona foydalanuvchi boshqaning so‘roviga chek yuklay olmasligi.
  const sharp = (await import('sharp')).default;
  const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 10, g: 90, b: 160 } } }).png().toBuffer();
  const form = new FormData();
  form.set('kind', 'SUBSCRIPTION_RECEIPT');
  form.set('linkType', 'Subscription');
  form.set('linkId', subscriptionId);
  form.set('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'x.png');
  return h.api('POST', '/media/uploads', { token: user.token, form });
}

async function uploadReceipt(user: TestUser, subscriptionId: string) {
  const assetId = await uploadImage(h, user.token, 'SUBSCRIPTION_RECEIPT', 'Subscription', subscriptionId, 80);
  return h.post(`/subscriptions/requests/${subscriptionId}/receipt`, user.token, { mediaAssetId: assetId });
}

describe('subscriptions: plans, requests and admin decisions', () => {
  it('lists plans with prices and savings', async () => {
    const res = await h.get('/subscriptions/plans', customer.token);
    expect(res.status).toBe(200);
    const plus = res.data.plans.find((plan: { code: string }) => plan.code === 'CUSTOMER_PLUS');
    expect(plus.features).toContain('SEE_DELETED_MESSAGES');
    expect(plus.prices.map((price: { months: number }) => price.months)).toEqual([1, 3, 12]);
    expect(plus.prices[0].savingPercent).toBe(0);
    expect(plus.prices[2].savingPercent).toBeGreaterThan(20);
    expect(res.data.methods).toEqual(['CLICK', 'PAYME', 'UZUM', 'CARD']);
    expect((await h.get('/subscriptions/plans', undefined)).status).toBe(401);
  });

  it('a customer requests Plus; a Click attempt is replaced by a card request; validation and ownership hold', async () => {
    expect((await req(customer.token, { planCode: 'MASTER_PRO', months: 1, method: 'CARD' })).status).toBe(403);
    expect((await req(customer.token, { planCode: 'CUSTOMER_PLUS', months: 2, method: 'CARD' })).status).toBe(400);
    expect((await req(customer.token, { planCode: 'CUSTOMER_PLUS', months: 1, method: 'BITCOIN' })).status).toBe(400);
    expect((await req(customer.token, { planCode: 'CUSTOMER_PLUS', months: 1, method: 'CASH' })).status).toBe(400); // naqd to‘lov yo‘q
    const click = await req(customer.token, { planCode: 'CUSTOMER_PLUS', months: 3, method: 'CLICK' });
    expect(click.status).toBe(201);
    expect(click.data).toMatchObject({ status: 'PENDING', months: 3, amount: '13500', method: 'CLICK' });
    expect(click.data.checkoutUrl).toContain('https://my.click.uz/services/pay?');
    expect(click.data.checkoutUrl).toContain(`transaction_param=${click.data.id}`);
    const card = await req(customer.token, { planCode: 'CUSTOMER_PLUS', months: 1, method: 'CARD' });
    expect(card.status).toBe(201);
    expect(card.data.checkoutUrl).toBeNull();
    expect((await h.db.subscription.findUniqueOrThrow({ where: { id: click.data.id } })).status).toBe('CANCELED'); // to‘lanmagan urinish almashtirildi
    const me = await h.get('/subscriptions/me', customer.token);
    expect(me.data.customer).toBeNull();
    expect(me.data.pending).toHaveLength(1);
    expect((await h.post(`/subscriptions/requests/${card.data.id}/cancel`, peer.token)).status).toBe(404);
    expect((await h.post(`/subscriptions/requests/${card.data.id}/cancel`, customer.token)).status).toBe(201);
    expect((await h.post(`/subscriptions/requests/${card.data.id}/cancel`, customer.token)).status).toBe(409);
  });

  it('Click: a successful payment activates the subscription instantly, with no admin step (idempotent, wrong amount refused)', async () => {
    const buyer = await createUser(h);
    const made = await req(buyer.token, { planCode: 'CUSTOMER_PLUS', months: 1, method: 'CLICK' });
    const id: string = made.data.id;
    const amount = '5000.00';
    const transId = `77${Math.floor(Math.random() * 100000)}`;
    const call = (body: Record<string, unknown>) => h.api('POST', '/payments/click/callback', { body });
    const wrong = await call({ click_trans_id: transId, service_id: 's1', merchant_trans_id: id, amount: '1000.00', action: '0', sign_time: 't1', sign_string: md5([transId, 's1', 'test-only-click-webhook-secret', id, '1000.00', '0', 't1']) });
    expect(wrong.body.error).toBe(-2);
    const prepare = await call({ click_trans_id: transId, service_id: 's1', merchant_trans_id: id, amount, action: '0', sign_time: 't1', sign_string: md5([transId, 's1', 'test-only-click-webhook-secret', id, amount, '0', 't1']) });
    expect(prepare.body.error).toBe(0);
    expect((await h.db.subscription.findUniqueOrThrow({ where: { id } })).status).toBe('PENDING');
    const prepareId = prepare.body.merchant_prepare_id;
    const complete = { click_trans_id: transId, service_id: 's1', merchant_trans_id: id, merchant_prepare_id: prepareId, amount, action: '1', sign_time: 't2', sign_string: md5([transId, 's1', 'test-only-click-webhook-secret', id, prepareId, amount, '1', 't2']) };
    expect((await call(complete)).body.error).toBe(0);
    const row = await h.db.subscription.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: 'ACTIVE', providerTxId: transId });
    expect(row.paidAt).not.toBeNull();
    expect((await h.get('/subscriptions/me', buyer.token)).data.customer).toMatchObject({ status: 'ACTIVE' });
    expect((await call(complete)).body.error).toBe(0); // takroriy chaqiruv xavfsiz
    expect(await h.db.subscription.count({ where: { userId: buyer.id, status: 'ACTIVE' } })).toBe(1);
    // Admin ruxsati kerak emas — hatto urinsa ham: avtomatik to‘lov admin tomonidan tasdiqlanmaydi.
    expect((await h.patch(`/admin/subscriptions/${id}/approve`, admin.token)).status).toBe(409);
  });

  it('Payme: CreateTransaction + PerformTransaction activates a Pro subscription; cancelling after completion revokes it', async () => {
    const made = await req(master.token, { planCode: 'MASTER_PRO', months: 1, method: 'PAYME' });
    const id: string = made.data.id;
    expect(made.data.checkoutUrl).toContain('checkout.test.paycom.uz');
    const auth = `Basic ${Buffer.from('Paycom:test-only-payme-secret').toString('base64')}`;
    const rpc = (method: string, params: Record<string, unknown>) => h.api('POST', '/payments/payme', { body: { jsonrpc: '2.0', id: 1, method, params }, headers: { authorization: auth } });
    const amount = 1_000_000; // 10 000 so‘m, tiyinda
    expect((await rpc('CheckPerformTransaction', { amount: 100, account: { order_id: id } })).body.error.code).toBe(-31001);
    expect((await rpc('CheckPerformTransaction', { amount, account: { order_id: id } })).body.result.allow).toBe(true);
    const txId = `pm-${randomUUID().slice(0, 12)}`;
    const created = await rpc('CreateTransaction', { id: txId, time: Date.now(), amount, account: { order_id: id } });
    expect(created.body.result).toMatchObject({ state: 1, transaction: id });
    expect((await h.db.masterProfile.findUniqueOrThrow({ where: { id: master.masterId } })).isPro).toBe(false);
    const performed = await rpc('PerformTransaction', { id: txId });
    expect(performed.body.result.state).toBe(2);
    expect((await h.db.subscription.findUniqueOrThrow({ where: { id } })).status).toBe('ACTIVE');
    expect((await h.db.masterProfile.findUniqueOrThrow({ where: { id: master.masterId } })).isPro).toBe(true);
    expect((await rpc('CheckTransaction', { id: txId })).body.result.state).toBe(2);
    const statement = await rpc('GetStatement', { from: Date.now() - 60_000, to: Date.now() + 60_000 });
    expect(statement.body.result.transactions.some((tx: { id: string }) => tx.id === txId)).toBe(true);
    const cancelled = await rpc('CancelTransaction', { id: txId, reason: 5 });
    expect(cancelled.body.result.state).toBe(-2);
    expect((await h.db.subscription.findUniqueOrThrow({ where: { id } })).status).toBe('CANCELED');
    expect((await h.db.masterProfile.findUniqueOrThrow({ where: { id: master.masterId } })).isPro).toBe(false);
  });

  it('Uzum: a signed webhook for a subscription activates it; a wrong amount is refused', async () => {
    const buyer = await createUser(h);
    const made = await req(buyer.token, { planCode: 'CUSTOMER_PLUS', months: 1, method: 'UZUM' });
    const send = (payload: Record<string, unknown>) => {
      const rawBody = JSON.stringify(payload);
      return h.api('POST', '/webhooks/payments/uzum', { rawBody, headers: { 'x-webhook-signature': createHmac('sha256', 'test-only-uzum-secret').update(rawBody).digest('hex') } });
    };
    const base = { paymentId: made.data.id, currency: 'UZS', providerPaymentId: `uz-${randomUUID().slice(0, 8)}` };
    expect((await send({ ...base, eventId: `e-${randomUUID()}`, status: 'SUCCEEDED', amount: 1 })).status).toBeGreaterThanOrEqual(400);
    expect((await h.db.subscription.findUniqueOrThrow({ where: { id: made.data.id } })).status).toBe('PENDING');
    expect((await send({ ...base, eventId: `e-${randomUUID()}`, status: 'SUCCEEDED', amount: 5000 })).status).toBeLessThan(300);
    expect((await h.db.subscription.findUniqueOrThrow({ where: { id: made.data.id } })).status).toBe('ACTIVE');
  });

  it('Card: the receipt is uploaded, then the admin approves (or rejects) — only card requests need an admin; Plus then reveals deleted and edited messages', async () => {
    const plain = await createAdmin(h, ['USERS']);
    const made = await req(customer.token, { planCode: 'CUSTOMER_PLUS', months: 1, method: 'CARD' });
    expect((await h.get('/admin/subscriptions', plain.token)).status).toBe(403); // SUBSCRIPTIONS huquqi yo‘q
    // Chek yuklanmaguncha tasdiqlab bo‘lmaydi; begonaning cheki ham qabul qilinmaydi.
    expect((await h.patch(`/admin/subscriptions/${made.data.id}/approve`, admin.token)).status).toBe(409);
    expect((await uploadReceiptAs(peer, made.data.id)).status).toBeGreaterThanOrEqual(400);
    const attached = await uploadReceipt(customer, made.data.id);
    expect(attached.status).toBe(201);
    expect(attached.data.hasReceipt).toBe(true);
    // Chek yuklangach so‘rov yopilmaydi va yangisi ochilmaydi.
    expect((await req(customer.token, { planCode: 'CUSTOMER_PLUS', months: 3, method: 'CARD' })).status).toBe(409);
    const list = await h.get('/admin/subscriptions?status=PENDING', admin.token);
    const item = list.data.items.find((entry: { id: string }) => entry.id === made.data.id);
    expect(item.receiptAssetId).toBeTruthy();
    const summary = await h.get('/admin/subscriptions/summary', admin.token);
    expect(summary.data.pendingReceipts).toBeGreaterThanOrEqual(1);

    // Suhbat: peer yozadi, tahrirlaydi va o‘chiradi.
    const conv = await h.db.conversation.create({ data: { type: 'DIRECT', directKey: `${customer.id}:${peer.id}`, participants: { create: [{ userId: customer.id, roles: ['CUSTOMER'] }, { userId: peer.id, roles: ['MASTER'] }] } } });
    const edited = await h.db.message.create({ data: { conversationId: conv.id, senderId: peer.id, senderPanel: 'MASTER', type: 'TEXT', text: 'yangi matn', editedAt: new Date() } });
    await h.db.messageEdit.create({ data: { messageId: edited.id, previousText: 'eski matn' } });
    const gone = await h.db.message.create({ data: { conversationId: conv.id, senderId: peer.id, senderPanel: 'MASTER', type: 'TEXT', text: 'o‘chirilgan sir', deletedAt: new Date() } });
    const before = await h.get(`/conversations/${conv.id}/messages`, customer.token);
    const maskedBefore = before.data.items.find((entry: { id: string }) => entry.id === gone.id);
    expect(maskedBefore).toMatchObject({ deleted: true, text: null });
    expect(maskedBefore.original).toBeUndefined();
    expect(before.data.perks.seeDeleted).toBe(false);

    const approved = await h.patch(`/admin/subscriptions/${made.data.id}/approve`, admin.token);
    expect(approved.status).toBe(200);
    expect(approved.data.status).toBe('ACTIVE');
    expect((await h.patch(`/admin/subscriptions/${made.data.id}/approve`, admin.token)).status).toBe(409);
    const after = await h.get(`/conversations/${conv.id}/messages`, customer.token);
    expect(after.data.perks.seeDeleted).toBe(true);
    expect(after.data.items.find((entry: { id: string }) => entry.id === gone.id)).toMatchObject({ deleted: true, original: { text: 'o‘chirilgan sir' } });
    expect(after.data.items.find((entry: { id: string }) => entry.id === edited.id).editHistory[0].previousText).toBe('eski matn');
    const peerView = await h.get(`/conversations/${conv.id}/messages`, peer.token);
    expect(peerView.data.items.find((entry: { id: string }) => entry.id === gone.id).original).toBeUndefined();

    // Muddat tugasa — imkoniyat yo‘qoladi.
    await h.db.subscription.update({ where: { id: made.data.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    expect((await h.get(`/conversations/${conv.id}/messages`, customer.token)).data.perks.seeDeleted).toBe(false);
  });

  it('rejecting needs a reason; grants stack after the current period; revoke ends it', async () => {
    const buyer = await createUser(h);
    const made = await req(buyer.token, { planCode: 'CUSTOMER_PLUS', months: 1, method: 'CARD' });
    await uploadReceipt(buyer, made.data.id);
    expect((await h.patch(`/admin/subscriptions/${made.data.id}/reject`, admin.token, { reason: '' })).status).toBe(400);
    const rejected = await h.patch(`/admin/subscriptions/${made.data.id}/reject`, admin.token, { reason: 'To‘lov topilmadi' });
    expect(rejected.data).toMatchObject({ status: 'REJECTED', rejectReason: 'To‘lov topilmadi' });

    const accountNumber = (await h.db.user.findUniqueOrThrow({ where: { id: buyer.id }, select: { accountNumber: true } })).accountNumber;
    const first = await h.post('/admin/subscriptions/grant', admin.token, { user: String(accountNumber), planCode: 'CUSTOMER_PLUS', months: 1, note: 'aksiya' });
    expect(first.status).toBe(201);
    const second = await h.post('/admin/subscriptions/grant', admin.token, { user: buyer.id, planCode: 'CUSTOMER_PLUS', months: 2 });
    expect(new Date(second.data.startsAt).getTime()).toBe(new Date(first.data.endsAt).getTime()); // davom ettiriladi
    expect((await h.post('/admin/subscriptions/grant', admin.token, { user: buyer.id, planCode: 'MASTER_PRO', months: 1 })).status).toBe(400); // usta emas
    expect((await h.post('/admin/subscriptions/grant', admin.token, { user: '999999999', planCode: 'CUSTOMER_PLUS', months: 1 })).status).toBe(404);
    const revoked = await h.patch(`/admin/subscriptions/${first.data.id}/revoke`, admin.token, { reason: 'qoidabuzarlik' });
    expect(revoked.data.status).toBe('CANCELED');
    expect(await h.db.auditLog.count({ where: { action: { in: ['SUBSCRIPTION_REJECTED', 'SUBSCRIPTION_GRANTED', 'SUBSCRIPTION_REVOKED'] }, actorId: admin.id } })).toBeGreaterThanOrEqual(4);
  });

  it('Pro: badge, catalog boost and a higher portfolio limit for masters; priority flag for Plus requests', async () => {
    expect((await h.db.masterProfile.findUniqueOrThrow({ where: { id: master.masterId }, select: { isPro: true } })).isPro).toBe(false);
    expect((await h.post('/admin/subscriptions/grant', admin.token, { user: master.id, planCode: 'MASTER_PRO', months: 1 })).status).toBe(201);
    const after = await h.db.masterProfile.findUniqueOrThrow({ where: { id: master.masterId }, select: { isPro: true, proUntil: true } });
    expect(after.isPro).toBe(true);
    const pub = await h.get(`/masters/${master.masterId}`, customer.token);
    expect(pub.data.isPro).toBe(true);
    const list = await h.get('/masters?limit=50', customer.token);
    expect(list.data.items[0].isPro).toBe(true); // katalogda Pro birinchi

    // Priority: Plus mijozning so‘rovi tezkor deb belgilanadi.
    const plus = await createUser(h);
    await h.post('/admin/subscriptions/grant', admin.token, { user: plus.id, planCode: 'CUSTOMER_PLUS', months: 1 });
    const created = await h.post('/problem-requests', plus.token, { preferredStartAt: soon(), title: 'Tezkor', description: 'Tezkor so‘rov uchun yetarlicha uzun tavsif matni.', serviceId: (await firstService(h)).id, latitude: 41.3, longitude: 69.2 });
    expect(created.status).toBe(201);
    expect((await h.db.problemRequest.findUniqueOrThrow({ where: { id: created.data.id }, select: { isPriority: true } })).isPriority).toBe(true);
    const normal = await h.post('/problem-requests', customer.token, { preferredStartAt: soon(), title: 'Oddiy', description: 'Oddiy so‘rov uchun yetarlicha uzun tavsif matni.', serviceId: (await firstService(h)).id, latitude: 41.3, longitude: 69.2 });
    expect((await h.db.problemRequest.findUniqueOrThrow({ where: { id: normal.data.id }, select: { isPriority: true } })).isPriority).toBe(false);
  });

  it('user search for gifting: full-name tokens in any order, phone/ID, newest registered first when empty, masters filter, admins excluded', async () => {
    const stamp = `Qidiruv${Date.now() % 100000}`;
    const older = await createUser(h, ['CUSTOMER'], { firstName: stamp });
    await h.db.user.update({ where: { id: older.id }, data: { lastName: 'Karimov', createdAt: new Date(Date.now() - 5 * 86_400_000) } });
    const newer = await createUser(h, ['CUSTOMER'], { firstName: stamp });
    await h.db.user.update({ where: { id: newer.id }, data: { lastName: 'Aliyev' } });
    const byName = await h.get(`/admin/subscriptions/users?q=${stamp}`, admin.token);
    expect(byName.status).toBe(200);
    expect(byName.data.items.map((item: { id: string }) => item.id)).toEqual([newer.id, older.id]); // yangi tepada
    const reversed = await h.get(`/admin/subscriptions/users?q=${encodeURIComponent('karimov ' + stamp.toLowerCase())}`, admin.token);
    expect(reversed.data.items.map((item: { id: string }) => item.id)).toEqual([older.id]); // ism-familiya tartibi muhim emas
    const byPhone = await h.get(`/admin/subscriptions/users?q=${encodeURIComponent(older.phone)}`, admin.token);
    expect(byPhone.data.items[0].id).toBe(older.id);
    // ID bo‘yicha qisman moslik: raqamning bir qismi yozilsa, shu raqam qatnashgan barcha foydalanuvchilar chiqadi.
    const olderNumber = (await h.db.user.findUniqueOrThrow({ where: { id: older.id }, select: { accountNumber: true } })).accountNumber;
    const idPart = String(olderNumber).slice(-2);
    const byIdPart = await h.get(`/admin/subscriptions/users?q=${idPart}`, admin.token);
    expect(byIdPart.status).toBe(200);
    expect(byIdPart.data.items.some((item: { id: string }) => item.id === older.id)).toBe(true);
    const byFullId = await h.get(`/admin/subscriptions/users?q=${olderNumber}`, admin.token);
    expect(byFullId.data.items.some((item: { id: string }) => item.id === older.id)).toBe(true);
    const empty = await h.get('/admin/subscriptions/users', admin.token);
    const dates = empty.data.items.map((item: { createdAt: string }) => new Date(item.createdAt).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
    expect(empty.data.items.some((item: { id: string }) => item.id === admin.id)).toBe(false); // adminlar chiqmaydi
    const masters = await h.get('/admin/subscriptions/users?audience=MASTER', admin.token);
    expect(masters.data.items.length).toBeGreaterThan(0);
    expect(masters.data.items.every((item: { isMaster: boolean }) => item.isMaster)).toBe(true);
    expect((await h.get('/admin/subscriptions/users', customer.token)).status).toBe(403);
    expect((await h.get('/admin/subscriptions/users?audience=ROBOT', admin.token)).status).toBe(400);
  });
});
