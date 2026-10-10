import type { Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createAdmin, createSuperAdmin, createUser, type Harness, type TestUser } from '../helpers/harness';

let h: Harness;
let admin: TestUser;
let other: TestUser;
let customer: TestUser;
const ids: Record<string, string> = {};

beforeAll(async () => {
  h = await bootHarness();
  admin = await createSuperAdmin(h);
  other = await createAdmin(h, ['USERS']);
  customer = await createUser(h, ['CUSTOMER']);
  const log = await h.db.auditLog.create({ data: { actorId: customer.id, action: 'ORDER_DISPUTED', targetType: 'User', targetId: customer.id, reason: 'pulim berilmadi', ipAddress: '10.1.1.1' } });
  const make = async (key: string, data: { title: string; body: string; template: string; data: Prisma.InputJsonObject }, status: 'SENT' | 'READ' = 'SENT') => {
    const row = await h.db.notification.create({ data: { userId: admin.id, channel: 'IN_APP', status, readAt: status === 'READ' ? new Date() : null, ...data } });
    ids[key] = row.id;
  };
  await make('dispute', { title: 'Buyurtma bo‘yicha nizo ochildi', body: 'Mijoz · Sabab: pulim berilmadi', template: 'admin.audit', data: { auditLogId: log.id, action: 'ORDER_DISPUTED', path: '/admin/audit' } });
  await make('payment', { title: 'To‘lov qaytarildi', body: 'Admin', template: 'admin.audit', data: { action: 'PAYMENT_REFUNDED' } }, 'READ');
  await make('system', { title: 'Xizmat yangilandi', body: 'Admin', template: 'admin.audit', data: { action: 'SERVICE_UPDATED' } });
  await h.db.notification.create({ data: { userId: other.id, channel: 'IN_APP', title: 'Boshqa adminniki', body: 'x', template: 'admin.audit', data: { action: 'SERVICE_UPDATED' } } });
});
afterAll(async () => {
  await h.close();
});

describe('admin notifications', () => {
  it('is admin-only and validates filters', async () => {
    expect((await h.get('/admin/notifications', customer.token)).status).toBe(403);
    expect((await h.get('/admin/notifications?category=WEIRD', admin.token)).status).toBe(400);
    expect((await h.get('/admin/notifications?priority=URGENT', admin.token)).status).toBe(400);
  });

  it('classifies, filters and paginates only the caller’s own notifications', async () => {
    const all = await h.get('/admin/notifications?limit=100', admin.token);
    expect(all.status).toBe(200);
    expect(all.data.items.map((i: { id: string }) => i.id).sort()).toEqual(Object.values(ids).sort());
    const dispute = all.data.items.find((i: { id: string }) => i.id === ids.dispute);
    expect(dispute).toEqual(expect.objectContaining({ category: 'DISPUTE', priority: 'HIGH', read: false, actor: expect.objectContaining({ role: 'CUSTOMER' }) }));
    const high = await h.get('/admin/notifications?priority=HIGH', admin.token);
    expect(high.data.items.map((i: { id: string }) => i.id).sort()).toEqual([ids.dispute, ids.payment].sort()); // nizo va pul qaytarish — yuqori daraja
    const payment = await h.get('/admin/notifications?category=PAYMENT', admin.token);
    expect(payment.data.items.map((i: { id: string }) => i.id)).toEqual([ids.payment]);
    const unread = await h.get('/admin/notifications?state=UNREAD&limit=1&page=2', admin.token);
    expect(unread.data.total).toBe(2);
    expect(unread.data.pages).toBe(2);
    const search = await h.get('/admin/notifications?search=nizo', admin.token);
    expect(search.data.items).toHaveLength(1);
  });

  it('stats agree with the list, detail resolves related audit data and read/unread work', async () => {
    const stats = await h.get('/admin/notifications/stats', admin.token);
    expect(stats.data.total.total).toBe(3);
    expect(stats.data.unread.total).toBe(2);
    expect(stats.data.important.total).toBe(2);
    expect(stats.data.system.total).toBe(1);
    const detail = await h.get(`/admin/notifications/${ids.dispute}`, admin.token);
    expect(detail.data.audit).toEqual(expect.objectContaining({ action: 'ORDER_DISPUTED', reason: 'pulim berilmadi', ipAddress: '10.1.1.1' }));
    expect(detail.data.targetUser).toEqual(expect.objectContaining({ id: customer.id }));
    expect(detail.data.events.map((e: { kind: string }) => e.kind)).toEqual(expect.arrayContaining(['created', 'audit']));
    expect((await h.get(`/admin/notifications/${ids.dispute}`, other.token)).status).toBe(404);
    const read = await h.post('/admin/notifications/read', admin.token, { ids: [ids.dispute, ids.system] });
    expect(read.data.count).toBe(2);
    expect((await h.get('/admin/notifications/stats', admin.token)).data.unread.total).toBe(0);
    expect((await h.patch(`/admin/notifications/${ids.system}/unread`, admin.token)).status).toBe(200);
    expect((await h.get('/admin/notifications/stats', admin.token)).data.unread.total).toBe(1);
    // boshqa adminning bildirishnomasiga tegib bo‘lmaydi
    expect((await h.post('/admin/notifications/read', other.token, { ids: [ids.payment] })).data.count).toBe(0);
  });
});
