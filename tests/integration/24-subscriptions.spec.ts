import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createAdmin, createMaster, createSuperAdmin, createUser, firstService, type Harness, type TestMaster, type TestUser } from '../helpers/harness';

let h: Harness;
let customer: TestUser;
let peer: TestUser;
let master: TestMaster;
let admin: TestUser;
let ip = 0;
const asIp = () => `10.24.0.${++ip}`;

beforeAll(async () => {
  process.env.RATE_LIMIT_CALL_MAX = '200';
  h = await bootHarness();
  const service = await firstService(h);
  customer = await createUser(h);
  peer = await createUser(h);
  master = await createMaster(h, service.id);
  admin = await createSuperAdmin(h);
});
afterAll(async () => {
  await h.close();
  delete process.env.RATE_LIMIT_CALL_MAX;
});

const req = (token: string, body: Record<string, unknown>) => h.api('POST', '/subscriptions/requests', { token, body, ip: asIp() });

describe('subscriptions: plans, requests and admin decisions', () => {
  it('lists plans with prices and savings', async () => {
    const res = await h.get('/subscriptions/plans', customer.token);
    expect(res.status).toBe(200);
    const plus = res.data.plans.find((plan: { code: string }) => plan.code === 'CUSTOMER_PLUS');
    expect(plus.features).toContain('SEE_DELETED_MESSAGES');
    expect(plus.prices.map((price: { months: number }) => price.months)).toEqual([1, 3, 12]);
    expect(plus.prices[0].savingPercent).toBe(0);
    expect(plus.prices[2].savingPercent).toBeGreaterThan(20);
    expect((await h.get('/subscriptions/plans', undefined)).status).toBe(401);
  });

  it('a customer requests Plus once at a time; masters-only plan is refused for non-masters; bad input is rejected', async () => {
    expect((await req(customer.token, { planCode: 'MASTER_PRO', months: 1, method: 'CARD' })).status).toBe(403);
    expect((await req(customer.token, { planCode: 'CUSTOMER_PLUS', months: 2, method: 'CARD' })).status).toBe(400);
    expect((await req(customer.token, { planCode: 'CUSTOMER_PLUS', months: 1, method: 'BITCOIN' })).status).toBe(400);
    const made = await req(customer.token, { planCode: 'CUSTOMER_PLUS', months: 3, method: 'CLICK' });
    expect(made.status).toBe(201);
    expect(made.data).toMatchObject({ status: 'PENDING', months: 3, amount: '79000', method: 'CLICK' });
    expect(made.data.reference).toMatch(/^GM-[0-9A-F]{8}$/);
    expect((await req(customer.token, { planCode: 'CUSTOMER_PLUS', months: 1, method: 'CARD' })).status).toBe(409);
    const me = await h.get('/subscriptions/me', customer.token);
    expect(me.data.customer).toBeNull();
    expect(me.data.pending).toHaveLength(1);
    // O‘z so‘rovini bekor qiladi; boshqasi — yo‘q.
    expect((await h.post(`/subscriptions/requests/${made.data.id}/cancel`, peer.token)).status).toBe(404);
    expect((await h.post(`/subscriptions/requests/${made.data.id}/cancel`, customer.token)).status).toBe(201);
    expect((await h.post(`/subscriptions/requests/${made.data.id}/cancel`, customer.token)).status).toBe(409);
  });

  it('admin approves → Plus is active and reveals the peer’s deleted and edited messages; expiry removes it', async () => {
    const plain = await createAdmin(h, ['USERS']);
    const made = await req(customer.token, { planCode: 'CUSTOMER_PLUS', months: 1, method: 'CASH' });
    expect((await h.get('/admin/subscriptions', plain.token)).status).toBe(403); // SUBSCRIPTIONS huquqi yo‘q
    const list = await h.get('/admin/subscriptions?status=PENDING', admin.token);
    expect(list.status).toBe(200);
    expect(list.data.items.some((item: { id: string }) => item.id === made.data.id)).toBe(true);

    // Suhbat: peer yozadi, tahrirlaydi va o‘chiradi.
    const conv = await h.db.conversation.create({ data: { type: 'DIRECT', directKey: `${customer.id}:${peer.id}`, participants: { create: [{ userId: customer.id, roles: ['CUSTOMER'] }, { userId: peer.id, roles: ['MASTER'] }] } } });
    const edited = await h.db.message.create({ data: { conversationId: conv.id, senderId: peer.id, senderPanel: 'MASTER', type: 'TEXT', text: 'yangi matn', editedAt: new Date() } });
    await h.db.messageEdit.create({ data: { messageId: edited.id, previousText: 'eski matn' } });
    const gone = await h.db.message.create({ data: { conversationId: conv.id, senderId: peer.id, senderPanel: 'MASTER', type: 'TEXT', text: 'o‘chirilgan sir', deletedAt: new Date() } });
    const before = await h.get(`/conversations/${conv.id}/messages`, customer.token);
    const maskedBefore = before.data.items.find((item: { id: string }) => item.id === gone.id);
    expect(maskedBefore).toMatchObject({ deleted: true, text: null });
    expect(maskedBefore.original).toBeUndefined();
    expect(before.data.perks.seeDeleted).toBe(false);

    const approved = await h.patch(`/admin/subscriptions/${made.data.id}/approve`, admin.token);
    expect(approved.status).toBe(200);
    expect(approved.data.status).toBe('ACTIVE');
    expect((await h.patch(`/admin/subscriptions/${made.data.id}/approve`, admin.token)).status).toBe(409);
    expect((await h.get('/subscriptions/me', customer.token)).data.customer).toMatchObject({ planCode: 'CUSTOMER_PLUS', status: 'ACTIVE' });

    const after = await h.get(`/conversations/${conv.id}/messages`, customer.token);
    expect(after.data.perks.seeDeleted).toBe(true);
    expect(after.data.items.find((item: { id: string }) => item.id === gone.id)).toMatchObject({ deleted: true, original: { text: 'o‘chirilgan sir' } });
    expect(after.data.items.find((item: { id: string }) => item.id === edited.id).editHistory[0].previousText).toBe('eski matn');
    // Suhbatdosh (obunasiz) o‘z tomonidan hech narsa qo‘shimcha ko‘rmaydi.
    const peerView = await h.get(`/conversations/${conv.id}/messages`, peer.token);
    expect(peerView.data.items.find((item: { id: string }) => item.id === gone.id).original).toBeUndefined();

    // Muddat tugasa — imkoniyat yo‘qoladi.
    await h.db.subscription.update({ where: { id: made.data.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    const expired = await h.get(`/conversations/${conv.id}/messages`, customer.token);
    expect(expired.data.perks.seeDeleted).toBe(false);
    expect((await h.get('/subscriptions/me', customer.token)).data.customer).toBeNull();
  });

  it('rejecting needs a reason; grants stack after the current period; revoke ends it', async () => {
    const buyer = await createUser(h);
    const made = await req(buyer.token, { planCode: 'CUSTOMER_PLUS', months: 1, method: 'CARD' });
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
    const mine = await req(master.token, { planCode: 'MASTER_PRO', months: 1, method: 'PAYME' });
    expect(mine.status).toBe(201);
    const before = await h.db.masterProfile.findUniqueOrThrow({ where: { id: master.masterId }, select: { isPro: true } });
    expect(before.isPro).toBe(false);
    expect((await h.patch(`/admin/subscriptions/${mine.data.id}/approve`, admin.token)).status).toBe(200);
    const after = await h.db.masterProfile.findUniqueOrThrow({ where: { id: master.masterId }, select: { isPro: true, proUntil: true } });
    expect(after.isPro).toBe(true);
    const pub = await h.get(`/masters/${master.masterId}`, customer.token);
    expect(pub.data.isPro).toBe(true);
    const list = await h.get('/masters?limit=50', customer.token);
    expect(list.data.items[0].isPro).toBe(true); // katalogda Pro birinchi

    // Priority: Plus mijozning so‘rovi tezkor deb belgilanadi.
    const plus = await createUser(h);
    await h.post('/admin/subscriptions/grant', admin.token, { user: plus.id, planCode: 'CUSTOMER_PLUS', months: 1 });
    const created = await h.post('/problem-requests', plus.token, { title: 'Tezkor', description: 'Tezkor so‘rov uchun yetarlicha uzun tavsif matni.', serviceId: (await firstService(h)).id, latitude: 41.3, longitude: 69.2 });
    expect(created.status).toBe(201);
    expect((await h.db.problemRequest.findUniqueOrThrow({ where: { id: created.data.id }, select: { isPriority: true } })).isPriority).toBe(true);
    const normal = await h.post('/problem-requests', customer.token, { title: 'Oddiy', description: 'Oddiy so‘rov uchun yetarlicha uzun tavsif matni.', serviceId: (await firstService(h)).id, latitude: 41.3, longitude: 69.2 });
    expect((await h.db.problemRequest.findUniqueOrThrow({ where: { id: normal.data.id }, select: { isPriority: true } })).isPriority).toBe(false);
  });
});
