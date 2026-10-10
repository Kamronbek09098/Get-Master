import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bookOrder,
  bootHarness,
  createAdmin,
  createMaster,
  createUser,
  freshService,
  type Harness,
  MISSING_UUID,
  payOrder,
  uploadImage,
} from '../helpers/harness';

let h: Harness;
beforeAll(async () => {
  h = await bootHarness();
});
afterAll(async () => {
  await h.close();
});

describe('E2E — o‘zbekcha xato formati', () => {
  it('mavjud bo‘lmagan sahifa uchun o‘zbekcha 404 qaytaradi', async () => {
    const res = await h.get('/mavjud-emas');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, statusCode: 404, message: 'Sahifa topilmadi' });
    expect(res.body.path).toContain('/mavjud-emas');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('token bo‘lmasa o‘zbekcha 401 qaytaradi', async () => {
    const res = await h.get('/users/me');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Kirish tokeni topilmadi');
  });

  it('validatsiya xatolarini o‘zbekcha qaytaradi', async () => {
    const customer = await createUser(h);
    const res = await h.post('/complaints', customer.token, { title: '', description: '' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('Ma’lumotlar tekshiruvdan o‘tmadi');
    expect(res.body.details).toContain('title: bu maydon bo‘sh bo‘lmasligi kerak');
  });

  it('topilmagan buyurtma uchun o‘zbekcha xabar qaytaradi', async () => {
    const customer = await createUser(h);
    const res = await h.get(`/orders/${MISSING_UUID}/additional-work`, customer.token);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Buyurtma topilmadi');
  });
});

describe('E2E — so‘rovdan sharhgacha to‘liq oqim', () => {
  it('request → offer → booking → order → qo‘shimcha ish → to‘lov → kafolat → sharh', async () => {
    const service = await freshService(h);
    const customer = await createUser(h);
    const master = await createMaster(h, service.id);
    const admin = await createAdmin(h);

    const me = await h.get('/users/me', customer.token);
    expect(me.status).toBe(200);
    expect(me.data.roles).toContain('CUSTOMER');

    const order = await bookOrder(h, customer, master, service.id, { price: 100000 });

    const bookings = await h.get('/bookings', customer.token);
    expect(bookings.status).toBe(200);
    expect(bookings.data.map((item: { id: string }) => item.id)).toContain(order.bookingId);

    await h.post(`/orders/${order.orderId}/confirm`, master.token);
    await h.post(`/orders/${order.orderId}/start-travel`, master.token);
    await h.post(`/orders/${order.orderId}/arrive`, master.token);

    const work = await h.post(`/orders/${order.orderId}/additional-work`, master.token, {
      reason: 'Quvur almashtirish',
      description: 'Eski quvur yorilgan',
      amount: 50000,
    });
    expect(work.status).toBe(201);
    expect(work.data.status).toBe('PENDING');

    const approved = await h.post(`/additional-work/${work.data.id}/approve`, customer.token);
    expect(approved.status).toBe(201);
    expect(approved.data.status).toBe('APPROVED');

    const again = await h.post(`/additional-work/${work.data.id}/approve`, customer.token);
    expect(again.status).toBe(409);
    expect(again.body.message).toBe('Qo‘shimcha ish so‘rovi allaqachon ko‘rib chiqilgan');

    const afterWork = await h.get(`/orders/${order.orderId}`, customer.token);
    expect(Number(afterWork.data.finalAmount)).toBe(150000);

    const before = await uploadImage(h, master.token, 'WORK_PROOF', 'Order', order.orderId, 71);
    await h.post(`/orders/${order.orderId}/work-proofs`, master.token, { stage: 'BEFORE', mediaAssetId: before });
    await h.post(`/orders/${order.orderId}/start-work`, master.token);
    const after = await uploadImage(h, master.token, 'WORK_PROOF', 'Order', order.orderId, 72);
    await h.post(`/orders/${order.orderId}/work-proofs`, master.token, { stage: 'AFTER', mediaAssetId: after });
    await h.post(`/orders/${order.orderId}/submit-completion`, master.token);
    await payOrder(h, customer, order.orderId);
    const confirmed = await h.post(`/orders/${order.orderId}/confirm-completion`, customer.token);
    expect(confirmed.status).toBeLessThan(300);

    const warranty = await h.post('/warranties', master.token, { orderId: order.orderId, days: 30 });
    expect(warranty.status).toBe(201);

    const duplicate = await h.post('/warranties', master.token, { orderId: order.orderId });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toBe('Bu buyurtma uchun kafolat allaqachon berilgan');

    const claim = await h.post(`/warranties/${warranty.data.id}/claims`, customer.token, {
      reason: 'Suv oqyapti',
      description: 'Ta’mirdan keyin yana suv oqa boshladi',
    });
    expect(claim.status).toBe(201);

    const resolved = await h.patch(`/warranty-claims/${claim.data.id}`, admin.token, {
      status: 'RESOLVED',
      resolution: 'Usta qayta tuzatdi',
    });
    expect(resolved.status).toBe(200);
    expect(resolved.data.resolvedAt).not.toBeNull();

    const review = await h.post('/reviews', customer.token, { orderId: order.orderId, rating: 5, comment: 'Zo‘r' });
    expect(review.status).toBe(201);

    const complaint = await h.post('/complaints', customer.token, {
      orderId: order.orderId,
      title: 'Kechikish',
      description: 'Usta 1 soat kechikdi',
    });
    expect(complaint.status).toBe(201);
    expect(complaint.data.type).toBe('COMPLAINT');

    const audit = await h.get('/audit-logs?action=WARRANTY_CLAIM_UPDATED', admin.token);
    expect(audit.status).toBe(200);
    expect(audit.data.items.length).toBeGreaterThan(0);
  });
});

describe('E2E — qoidalar va apellyatsiya', () => {
  it('admin qoida e’lon qiladi, foydalanuvchi qabul qiladi va apellyatsiya beradi', async () => {
    const admin = await createAdmin(h);
    const customer = await createUser(h);

    const policy = await h.post('/legal/policies', admin.token, {
      type: 'WARRANTY',
      version: `e2e-${Date.now()}`,
      title: 'Kafolat qoidalari',
      content: 'Kafolat 30 kun amal qiladi.',
    });
    expect(policy.status).toBe(201);

    const early = await h.post(`/legal/policies/${policy.data.id}/accept`, customer.token);
    expect(early.status).toBe(409);
    expect(early.body.message).toBe('Faqat e’lon qilingan qoidani qabul qilish mumkin');

    const published = await h.post(`/legal/policies/${policy.data.id}/publish`, admin.token);
    expect(published.data.status).toBe('PUBLISHED');

    const accepted = await h.post(`/legal/policies/${policy.data.id}/accept`, customer.token);
    expect(accepted.status).toBe(201);

    const action = await h.post('/user-actions', admin.token, {
      userId: customer.id,
      type: 'WARNING',
      reason: 'Qoidabuzarlik',
    });
    expect(action.status).toBe(201);

    const appeal = await h.post('/appeals', customer.token, { actionId: action.data.id, reason: 'Men aybdor emasman' });
    expect(appeal.status).toBe(201);

    const decided = await h.patch(`/appeals/${appeal.data.id}`, admin.token, { status: 'ACCEPTED', decision: 'Qabul qilindi' });
    expect(decided.status).toBe(200);

    const myActions = await h.get('/user-actions/me', customer.token);
    expect(myActions.data[0].liftedAt).not.toBeNull();
  });
});
