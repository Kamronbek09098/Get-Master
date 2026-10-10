import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookOrder, bootHarness, createAdmin, createMaster, createSuperAdmin, createUser, firstService, type Harness, payOrder, type TestUser } from '../helpers/harness';

let h: Harness;
let admin: TestUser;
let plain: TestUser;
let customer: TestUser;
let paymentId = '';

/** Toshkent (UTC+5) kunining boshi / oxiri — hisobotdagi kunlik kesim bilan bir xil chegaralar. */
const TZ = 5 * 3_600_000;
const startOfTashkentDay = (offsetDays: number) => {
  const local = Math.floor((Date.now() + TZ) / 86_400_000) + offsetDays;
  return new Date(local * 86_400_000 - TZ);
};
const range = () => ({ from: startOfTashkentDay(-6), to: new Date(startOfTashkentDay(1).getTime() - 1) });
const qs = (from: Date, to: Date) => `dateFrom=${encodeURIComponent(from.toISOString())}&dateTo=${encodeURIComponent(to.toISOString())}`;

beforeAll(async () => {
  h = await bootHarness();
  admin = await createSuperAdmin(h);
  plain = await createAdmin(h, ['USERS']);
  customer = await createUser(h, ['CUSTOMER'], { firstName: 'Hisobot' });
  const service = await firstService(h);
  const master = await createMaster(h, service.id);
  const order = await bookOrder(h, customer, master, service.id, { price: 120000 });
  const paid = await payOrder(h, customer, order.orderId);
  paymentId = paid.payment.id;
  // Bitta to'lovdan qisman qaytarish — qaytarishlar jurnali va tushum bog'lanishini tekshirish uchun.
  const refund = await h.post(`/payments/${paymentId}/refund`, admin.token, { amount: 20000, reason: 'CUSTOMER_REQUEST', note: 'hisobot testi' }, { idempotent: true });
  expect(refund.status).toBe(201);
});
afterAll(async () => {
  await h.close();
});

describe('admin reports — numbers match the database', () => {
  it('is restricted to admins with the REPORTS permission', async () => {
    expect((await h.get('/admin/reports/overview')).status).toBe(401);
    expect((await h.get('/admin/reports/overview', customer.token)).status).toBe(403);
    expect((await h.get('/admin/reports/overview', plain.token)).status).toBe(403);
    expect((await h.get('/admin/reports/payments', plain.token)).status).toBe(403);
  });

  it('KPI totals equal the raw database aggregates for the same period', async () => {
    const { from, to } = range();
    const res = await h.get(`/admin/reports/overview?${qs(from, to)}`, admin.token);
    expect(res.status).toBe(200);
    const { current } = res.data;

    const settled = await h.db.payment.aggregate({ where: { status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] }, succeededAt: { gte: from, lte: to } }, _sum: { amount: true }, _count: true });
    const refunds = await h.db.refund.aggregate({ where: { status: 'SUCCEEDED', completedAt: { gte: from, lte: to } }, _sum: { amount: true } });
    expect(current.revenue).toBe(Number(settled._sum.amount ?? 0));
    expect(current.settledPayments).toBe(settled._count);
    expect(current.refunded).toBe(Number(refunds._sum.amount ?? 0));
    expect(current.payments).toBe(await h.db.payment.count({ where: { createdAt: { gte: from, lte: to } } }));
    expect(current.orders).toBe(await h.db.order.count({ where: { createdAt: { gte: from, lte: to } } }));
    // Faol / yakunlangan / bekor qilingan — davrda yaratilgan buyurtmalarning hozirgi holati (buyurtmalar ro'yxati filtri bilan bir xil).
    const created = { createdAt: { gte: from, lte: to } };
    expect(current.active).toBe(await h.db.order.count({ where: { ...created, status: { in: ['BOOKED', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'WAITING_CONFIRMATION', 'DISPUTED'] } } }));
    expect(current.completed).toBe(await h.db.order.count({ where: { ...created, status: 'COMPLETED' } }));
    expect(current.cancelled).toBe(await h.db.order.count({ where: { ...created, status: 'CANCELLED' } }));
    expect(current.revenue).toBeGreaterThanOrEqual(120000);
    expect(current.refunded).toBeGreaterThanOrEqual(20000);
  });

  it('daily series sums equal the KPI totals (no double counting, Tashkent day buckets)', async () => {
    const { from, to } = range();
    const res = await h.get(`/admin/reports/overview?${qs(from, to)}`, admin.token);
    const { current, series, paymentStatus } = res.data;
    expect(series).toHaveLength(7);
    const days = series.map((p: { date: string }) => p.date);
    expect(new Set(days).size).toBe(7);
    expect([...days].sort()).toEqual(days);
    const sum = (key: string) => series.reduce((total: number, point: Record<string, number>) => total + point[key]!, 0);
    expect(sum('revenue')).toBe(current.revenue);
    expect(sum('refunded')).toBe(current.refunded);
    expect(sum('payments')).toBe(current.payments);
    expect(sum('orders')).toBe(current.orders);
    expect(sum('active')).toBe(current.active);
    expect(sum('completed')).toBe(current.completed);
    expect(sum('cancelled')).toBe(current.cancelled);
    // To'lovlar holati taqsimoti jami to'lovlar soniga teng.
    const groups = ['succeeded', 'pending', 'refunded', 'failed', 'cancelled'] as const;
    expect(groups.reduce((total, key) => total + paymentStatus[key].count, 0)).toBe(current.payments);
    // Summalar ham bazadagi to'lovlar summasiga teng.
    const all = await h.db.payment.aggregate({ where: { createdAt: { gte: from, lte: to } }, _sum: { amount: true } });
    expect(groups.reduce((total, key) => total + paymentStatus[key].amount, 0)).toBe(Number(all._sum.amount ?? 0));
    const succeeded = await h.db.payment.aggregate({ where: { status: 'SUCCEEDED', createdAt: { gte: from, lte: to } }, _sum: { amount: true }, _count: true });
    expect(paymentStatus.succeeded).toEqual({ count: succeeded._count, amount: Number(succeeded._sum.amount ?? 0) });
  });

  it('compares with the previous equal period using the same definitions', async () => {
    const { from, to } = range();
    const span = to.getTime() - from.getTime();
    const res = await h.get(`/admin/reports/overview?${qs(from, to)}`, admin.token);
    const prevFrom = new Date(from.getTime() - span - 1);
    const prevTo = new Date(from.getTime() - 1);
    const settled = await h.db.payment.aggregate({ where: { status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] }, succeededAt: { gte: prevFrom, lte: prevTo } }, _sum: { amount: true } });
    expect(res.data.previous.revenue).toBe(Number(settled._sum.amount ?? 0));
    expect((await h.get('/admin/reports/overview', admin.token)).data.previous).toBeNull();
  });

  it('flags a payment whose recorded refunded amount disagrees with the refund ledger', async () => {
    const before = (await h.get('/admin/reports/overview', admin.token)).data.reconciliation.mismatchCount;
    await h.db.payment.update({ where: { id: paymentId }, data: { refundedAmount: 50000 } });
    const res = await h.get('/admin/reports/overview', admin.token);
    expect(res.data.reconciliation.mismatchCount).toBe(before + 1);
    const hit = res.data.reconciliation.items.find((item: { paymentId: string }) => item.paymentId === paymentId);
    expect(hit).toMatchObject({ recorded: 50000, ledger: 20000, difference: 30000 });
    await h.db.payment.update({ where: { id: paymentId }, data: { refundedAmount: 20000 } });
    expect((await h.get('/admin/reports/overview', admin.token)).data.reconciliation.mismatchCount).toBe(before);
  });
});

describe('admin reports — payments table', () => {
  it('filters, searches and sorts server-side and keeps totals consistent', async () => {
    const all = await h.get('/admin/reports/payments?limit=50', admin.token);
    expect(all.status).toBe(200);
    expect(all.data.total).toBe(await h.db.payment.count());

    const byStatus = await h.get('/admin/reports/payments?status=refunded&limit=50', admin.token);
    expect(byStatus.data.items.length).toBeGreaterThan(0);
    for (const row of byStatus.data.items) expect(['REFUNDED', 'PARTIALLY_REFUNDED']).toContain(row.status);

    const byProvider = await h.get('/admin/reports/payments?provider=CLICK&limit=50', admin.token);
    for (const row of byProvider.data.items) expect(row.provider).toBe('CLICK');

    const desc = await h.get('/admin/reports/payments?sort=amount&dir=desc&limit=50', admin.token);
    const amounts = desc.data.items.map((row: { amount: string }) => Number(row.amount));
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
    const asc = await h.get('/admin/reports/payments?sort=amount&dir=asc&limit=50', admin.token);
    const ascAmounts = asc.data.items.map((row: { amount: string }) => Number(row.amount));
    expect(ascAmounts).toEqual([...ascAmounts].sort((a, b) => a - b));

    // Qidiruv: ID boshi, buyurtma raqami va mijoz ismi bo'yicha.
    const row = await h.db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: { select: { orderNumber: true } } } });
    for (const needle of [`#${paymentId.slice(0, 8).toUpperCase()}`, String(row.order.orderNumber), 'Hisobot']) {
      const found = await h.get(`/admin/reports/payments?search=${encodeURIComponent(needle)}&limit=50`, admin.token);
      expect(found.data.items.some((item: { id: string }) => item.id === paymentId), `search "${needle}"`).toBe(true);
    }

    // Pastdagi yig'indi: filtrga mos muvaffaqiyatli to'lovlar.
    const refunded = await h.get(`/admin/reports/payments?search=${paymentId.slice(0, 8)}`, admin.token);
    expect(refunded.data.filteredSettled).toMatchObject({ amount: 120000, refunded: 20000 });
  });

  it('paginates and rejects invalid query parameters', async () => {
    const service = await firstService(h);
    const master = await createMaster(h, service.id);
    for (const price of [70000, 80000]) await payOrder(h, customer, (await bookOrder(h, customer, master, service.id, { price })).orderId);
    const page1 = await h.get('/admin/reports/payments?limit=2&page=1', admin.token);
    const page2 = await h.get('/admin/reports/payments?limit=2&page=2', admin.token);
    expect(page1.data.items).toHaveLength(2);
    expect(page1.data.pages).toBe(Math.ceil(page1.data.total / 2));
    expect(page2.data.items.map((r: { id: string }) => r.id)).not.toEqual(page1.data.items.map((r: { id: string }) => r.id));
    for (const bad of ['sort=bogus', 'dir=sideways', 'status=nope', 'provider=BITCOIN', 'limit=500', 'page=0']) {
      expect((await h.get(`/admin/reports/payments?${bad}`, admin.token)).status, bad).toBe(400);
    }
  });
});

describe('admin reports — safe refunds', () => {
  it('a repeated refund request with the same Idempotency-Key is not applied twice', async () => {
    const created = await bookOrder(h, customer, await createMaster(h, (await firstService(h)).id), (await firstService(h)).id, { price: 90000 });
    const { payment } = await payOrder(h, customer, created.orderId);
    const body = { amount: 10000, reason: 'CUSTOMER_REQUEST', note: 'idempotent' };
    const key = `idem-${Date.now()}`;
    const first = await h.api('POST', `/payments/${payment.id}/refund`, { token: admin.token, body, headers: { 'idempotency-key': key } });
    const second = await h.api('POST', `/payments/${payment.id}/refund`, { token: admin.token, body, headers: { 'idempotency-key': key } });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const row = await h.db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(Number(row.refundedAmount)).toBe(10000);
    expect(await h.db.refund.count({ where: { paymentId: payment.id } })).toBe(1);
  });

  it('refuses to refund more than what is left', async () => {
    const row = await h.db.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const left = Number(row.amount) - Number(row.refundedAmount);
    const tooMuch = await h.post(`/payments/${paymentId}/refund`, admin.token, { amount: left + 1, reason: 'OTHER', note: 'too much' }, { idempotent: true });
    expect(tooMuch.status).toBe(409);
  });
});
