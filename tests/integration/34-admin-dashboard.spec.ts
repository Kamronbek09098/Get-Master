import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookOrder, bootHarness, createAdmin, createMaster, createSuperAdmin, createUser, firstService, type Harness, payOrder, type TestUser } from '../helpers/harness';

let h: Harness;
let admin: TestUser;
let customer: TestUser;

const TZ = 5 * 3_600_000;
const tashkentMidnight = () => new Date(Math.floor((Date.now() + TZ) / 86_400_000) * 86_400_000 - TZ);
const grouped = (rows: unknown, key: string) => Object.fromEntries((rows as Array<Record<string, unknown> & { _count: number }>).map((row) => [String(row[key]), row._count]));

beforeAll(async () => {
  h = await bootHarness();
  admin = await createSuperAdmin(h);
  await createAdmin(h, ['USERS']); // admin akkauntlari «foydalanuvchilar» hisobiga kirmasligini tekshirish uchun
  customer = await createUser(h, ['CUSTOMER']);
  const service = await firstService(h);
  const master = await createMaster(h, service.id);
  const order = await bookOrder(h, customer, master, service.id, { price: 55000 });
  await payOrder(h, customer, order.orderId);
});
afterAll(async () => {
  await h.close();
});

describe('admin dashboard — every figure comes from the database', () => {
  it('totals and status breakdowns equal raw database counts', async () => {
    const res = await h.get('/admin/dashboard', admin.token);
    expect(res.status).toBe(200);
    const d = res.data;
    const people = { userRoles: { some: { role: { in: ['CUSTOMER', 'MASTER'] as Array<'CUSTOMER' | 'MASTER'> } } } };
    expect(d.users.byStatus).toEqual(grouped(await h.db.user.groupBy({ by: ['status'], _count: true, where: people }), 'status'));
    expect(d.users.total).toBe(await h.db.user.count({ where: people }));
    // Admin akkauntlari hisobga kirmaydi.
    expect(d.users.total).toBeLessThan(await h.db.user.count());
    expect(d.masters.byStatus).toEqual(grouped(await h.db.masterProfile.groupBy({ by: ['status'], _count: true }), 'status'));
    expect(d.requests.total).toBe(await h.db.problemRequest.count());
    expect(d.requests.submitted).toBe(await h.db.problemRequest.count({ where: { status: { not: 'DRAFT' } } }));
    expect(d.bookings.total).toBe(await h.db.booking.count());
    expect(d.orders.byStatus).toEqual(grouped(await h.db.order.groupBy({ by: ['status'], _count: true }), 'status'));
    expect(d.orders.total).toBe(await h.db.order.count());
    expect(d.disputes.total).toBe(await h.db.case.count({ where: { type: 'DISPUTE' } }));
    const reviews = await h.db.review.aggregate({ _count: true, _avg: { rating: true }, where: { status: 'PUBLISHED' } });
    expect(d.reviews.total).toBe(reviews._count);
    expect(Number(d.reviews.averageRating)).toBeCloseTo(Number(reviews._avg.rating ?? 0), 5);
    for (const row of await h.db.payment.groupBy({ by: ['status'], _count: true, _sum: { amount: true } })) {
      expect(d.payments.byStatus[row.status].count).toBe(row._count);
      expect(Number(d.payments.byStatus[row.status].amount)).toBe(Number(row._sum.amount));
    }
  });

  it('"needs attention" queues equal the database', async () => {
    const { attention } = (await h.get('/admin/dashboard', admin.token)).data;
    const documents = await h.db.masterVerification.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } });
    const portfolio = await h.db.masterPortfolio.count({ where: { status: 'PENDING' } });
    expect(attention.pendingVerifications).toBe(documents + portfolio);
    expect(attention.openCases).toBe(await h.db.case.count({ where: { status: { in: ['REPORTED', 'UNDER_REVIEW'] } } }));
    expect(attention.pendingSubscriptions).toBe(await h.db.subscription.count({ where: { status: 'PENDING' } }));
    expect(attention.activeOrders).toBe(await h.db.order.count({ where: { status: { in: ['CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'WAITING_CONFIRMATION'] } } }));
    expect(attention.errors24h).toBe(await h.db.errorLog.count({ where: { severity: 'ERROR', createdAt: { gte: new Date(Date.now() - 86_400_000) } } }));
  });

  it('"today" starts at Tashkent midnight and counts only customers/masters, non-draft requests and settled payments', async () => {
    const start = tashkentMidnight();
    const { today } = (await h.get('/admin/dashboard', admin.token)).data;
    expect(today.newUsers).toBe(await h.db.user.count({ where: { createdAt: { gte: start }, userRoles: { some: { role: { in: ['CUSTOMER', 'MASTER'] } } } } }));
    expect(today.newRequests).toBe(await h.db.problemRequest.count({ where: { createdAt: { gte: start }, status: { not: 'DRAFT' } } }));
    expect(today.newOrders).toBe(await h.db.order.count({ where: { createdAt: { gte: start } } }));
    expect(today.completedOrders).toBe(await h.db.order.count({ where: { status: 'COMPLETED', completedAt: { gte: start } } }));
    const revenue = await h.db.payment.aggregate({ where: { status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] }, succeededAt: { gte: start } }, _sum: { amount: true } });
    expect(Number(today.revenue)).toBe(Number(revenue._sum.amount ?? 0));
    expect(today.newOrders).toBeGreaterThanOrEqual(1);
  });

  it('subscriptions are split by customer/master with consistent totals', async () => {
    const { subscriptions: s } = (await h.get('/admin/dashboard', admin.token)).data;
    const now = new Date();
    for (const [key, audience] of [['customer', 'CUSTOMER'], ['master', 'MASTER']] as const) {
      expect(s[key].active).toBe(await h.db.subscription.count({ where: { audience, status: 'ACTIVE', endsAt: { gt: now } } }));
      expect(s[key].pending).toBe(await h.db.subscription.count({ where: { audience, status: 'PENDING' } }));
      expect(s[key].gifted).toBe(await h.db.subscription.count({ where: { audience, source: 'GRANT', status: 'ACTIVE', endsAt: { gt: now } } }));
    }
    expect(s.activeTotal).toBe(s.customer.active + s.master.active);
    expect(Number(s.revenueTotal)).toBe(Number(s.customer.revenue) + Number(s.master.revenue));
    expect(s.customer.planCode).toBe('CUSTOMER_PLUS');
    expect(s.master.planCode).toBe('MASTER_PRO');
  });

  it('feed figures count real rows for likes/comments and published posts only', async () => {
    const { feed } = (await h.get('/admin/dashboard', admin.token)).data;
    expect(feed.posts).toBe(await h.db.workPost.count({ where: { status: 'PUBLISHED' } }));
    expect(feed.likes).toBe(await h.db.workPostLike.count({ where: { post: { status: 'PUBLISHED' } } }));
    expect(feed.comments).toBe(await h.db.workPostComment.count({ where: { post: { status: 'PUBLISHED' } } }));
    const sums = await h.db.workPost.aggregate({ where: { status: 'PUBLISHED' }, _sum: { viewCount: true, shareCount: true } });
    expect(feed.views).toBe(sums._sum.viewCount ?? 0);
    expect(feed.shares).toBe(sums._sum.shareCount ?? 0);
  });

  it('recent orders are the newest five with correct people, service and status', async () => {
    const { recentOrders } = (await h.get('/admin/dashboard', admin.token)).data;
    const expected = await h.db.order.findMany({ take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, orderNumber: true, status: true } });
    expect(recentOrders.map((o: { id: string }) => o.id)).toEqual(expected.map((o) => o.id));
    for (const row of recentOrders) {
      const order = await h.db.order.findUniqueOrThrow({ where: { id: row.id }, include: { customer: true, master: { include: { user: true } } } });
      expect(row.orderNumber).toBe(order.orderNumber);
      expect(row.status).toBe(order.status);
      expect(row.customer.id).toBe(order.customerId);
      expect(row.master.id).toBe(order.master.userId);
      expect(typeof row.service).toBe('string');
    }
  });

  it('orders series covers consecutive Tashkent days and sums to the database counts', async () => {
    for (const days of [7, 30, 90]) {
      const res = await h.get(`/admin/dashboard/orders-series?days=${days}`, admin.token);
      expect(res.status).toBe(200);
      expect(res.data.points).toHaveLength(days);
      const dates: string[] = res.data.points.map((p: { date: string }) => p.date);
      expect(new Set(dates).size).toBe(days);
      expect([...dates].sort()).toEqual(dates);
      const from = new Date(Date.parse(`${dates[0]}T00:00:00+05:00`));
      const created = res.data.points.reduce((total: number, p: { created: number }) => total + p.created, 0);
      expect(created).toBe(await h.db.order.count({ where: { createdAt: { gte: from } } }));
    }
    expect((await h.get('/admin/dashboard/orders-series?days=13', admin.token)).data.points).toHaveLength(7);
  });

  it('orders summary (orders page) equals the database', async () => {
    const res = await h.get('/admin/orders/summary', admin.token);
    expect(res.status).toBe(200);
    expect(res.data.total).toBe(await h.db.order.count());
    const completed = await h.db.order.aggregate({ where: { status: 'COMPLETED' }, _sum: { finalAmount: true, platformFee: true } });
    expect(Number(res.data.completedAmount)).toBe(Number(completed._sum.finalAmount ?? 0));
    expect(Number(res.data.platformFee)).toBe(Number(completed._sum.platformFee ?? 0));
  });
});
