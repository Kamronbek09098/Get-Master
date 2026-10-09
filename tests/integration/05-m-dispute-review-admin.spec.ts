import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookOrder, bootHarness, createAdmin, createMaster, createUser, firstService, type Harness, MISSING_UUID, payOrder, type TestMaster, type TestUser, uploadImage } from '../helpers/harness';

let h: Harness;
let service: { id: string };
let admin: TestUser;

beforeAll(async () => {
  h = await bootHarness();
  service = await firstService(h);
  admin = await createAdmin(h);
});
afterAll(async () => {
  await h.close();
});

async function orderIn(status: 'BOOKED' | 'COMPLETED', customer: TestUser, master: TestMaster) {
  const order = await bookOrder(h, customer, master, service.id);
  if (status !== 'BOOKED') await h.db.order.update({ where: { id: order.orderId }, data: { status } });
  return order.orderId;
}

describe('M06 — disputes', () => {
  let customer: TestUser;
  let master: TestMaster;
  let outsider: TestUser;

  beforeAll(async () => {
    customer = await createUser(h, ['CUSTOMER']);
    outsider = await createUser(h, ['CUSTOMER']);
    master = await createMaster(h, service.id);
  });

  const body = (orderId: string) => ({ orderId, title: 'Work not done', description: 'The tap still leaks after the visit.' });

  it('only participants of the order can open a dispute; validation is enforced', async () => {
    const orderId = await orderIn('COMPLETED', customer, master);
    expect((await h.post('/disputes', outsider.token, body(orderId))).status).toBe(403);
    expect((await h.post('/disputes', customer.token, { ...body(orderId), title: '' })).status).toBe(400);
    expect((await h.post('/disputes', customer.token, { ...body(orderId), status: 'RESOLVED' })).status).toBe(400);
    expect((await h.post('/disputes', customer.token, body(MISSING_UUID))).status).toBe(404);
    expect((await h.post('/disputes', admin.token, body(orderId))).status).toBe(403);
    const ok = await h.post('/disputes', master.token, body(orderId));
    expect(ok.status).toBe(201);
    expect(ok.data.status).toBe('REPORTED');
    expect(ok.data.openedById).toBe(master.id);
    expect(ok.data.targetUserId).toBe(customer.id);
  });

  it('a second open dispute on the same order is refused — including under a concurrent burst', async () => {
    const orderId = await orderIn('COMPLETED', customer, master);
    const results = await Promise.all(Array.from({ length: 6 }, () => h.post('/disputes', customer.token, body(orderId))));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(5);
    expect(await h.db.case.count({ where: { orderId, type: 'DISPUTE' } })).toBe(1);
  });

  it('POST /orders/:id/dispute and POST /disputes cannot create parallel cases', async () => {
    const orderId = (await bookOrder(h, customer, master, service.id)).orderId;
    await h.db.order.update({ where: { id: orderId }, data: { status: 'IN_PROGRESS' } });
    expect((await h.post(`/orders/${orderId}/dispute`, customer.token, { reason: 'Damage' })).status).toBe(201);
    expect((await h.post('/disputes', customer.token, body(orderId))).status).toBe(409);
  });

  it('evidence must reference the caller’s own READY media', async () => {
    const orderId = await orderIn('COMPLETED', customer, master);
    const foreignKey = 'media/00000000-0000-4000-8000-000000000001/original';
    const res = await h.post('/disputes', customer.token, { ...body(orderId), evidence: [{ type: 'IMAGE', storageKey: foreignKey }] });
    expect(res.status).toBe(403);
    const text = await h.post('/disputes', customer.token, { ...body(orderId), evidence: [{ type: 'MESSAGE', text: 'my statement' }] });
    expect(text.status).toBe(201);
    expect(text.data.evidence).toHaveLength(1);
  });

  it('is visible only to its two parties (BOLA) and lists are scoped', async () => {
    const orderId = await orderIn('COMPLETED', customer, master);
    const d = (await h.post('/disputes', customer.token, body(orderId))).data;
    expect((await h.get(`/disputes/${d.id}`, customer.token)).status).toBe(200);
    expect((await h.get(`/disputes/${d.id}`, master.token)).status).toBe(200);
    expect((await h.get(`/disputes/${d.id}`, outsider.token)).status).toBe(403);
    expect((await h.get(`/disputes/${MISSING_UUID}`, customer.token)).status).toBe(404);
    expect((await h.get('/disputes', outsider.token)).data.items).toEqual([]);
    const mine = await h.get('/disputes?limit=100', customer.token);
    expect(mine.data.items.every((c: any) => c.openedById === customer.id || c.targetUserId === customer.id)).toBe(true);
    expect((await h.get('/disputes?status=NOPE', customer.token)).status).toBe(400);
  });

  it('admin drives the lifecycle REPORTED → UNDER_REVIEW → CONFIRMED → RESOLVED; every step is audited; illegal jumps are 409', async () => {
    const orderId = await orderIn('COMPLETED', customer, master);
    const d = (await h.post('/disputes', customer.token, body(orderId))).data;
    const patch = (status: string, decision?: string, token = admin.token) => h.patch(`/disputes/${d.id}/status`, token, { status, decision });

    expect((await patch('UNDER_REVIEW', undefined, customer.token)).status).toBe(403);
    expect((await patch('UNDER_REVIEW', undefined, master.token)).status).toBe(403);
    expect((await patch('RESOLVED')).status).toBe(409);
    expect((await patch('CONFIRMED')).status).toBe(409);
    expect((await patch('BOGUS')).status).toBe(400);

    expect((await patch('UNDER_REVIEW')).data.status).toBe('UNDER_REVIEW');
    expect((await patch('UNDER_REVIEW')).status).toBe(409);
    const confirmed = await patch('CONFIRMED', 'Master must redo the work');
    expect(confirmed.data.decision).toBe('Master must redo the work');
    const resolved = await patch('RESOLVED');
    expect(resolved.data.status).toBe('RESOLVED');
    expect(resolved.data.resolvedAt).toBeTruthy();
    expect((await patch('DISMISSED')).status).toBe(409);
    expect((await patch('UNDER_REVIEW')).status).toBe(409);

    const audit = await h.db.auditLog.findMany({ where: { action: 'DISPUTE_STATUS_CHANGED', targetId: d.id }, orderBy: { createdAt: 'asc' } });
    expect(audit.map((a) => (a.after as any).status)).toEqual(['UNDER_REVIEW', 'CONFIRMED', 'RESOLVED']);
    expect(audit.every((a) => a.actorId === admin.id)).toBe(true);
  });

  it('two admins racing the same transition: exactly one wins', async () => {
    const orderId = await orderIn('COMPLETED', customer, master);
    const d = (await h.post('/disputes', customer.token, body(orderId))).data;
    const other = await createAdmin(h);
    const results = await Promise.all([
      h.patch(`/disputes/${d.id}/status`, admin.token, { status: 'UNDER_REVIEW' }),
      h.patch(`/disputes/${d.id}/status`, other.token, { status: 'UNDER_REVIEW' }),
      h.patch(`/disputes/${d.id}/status`, admin.token, { status: 'UNDER_REVIEW' }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    expect(await h.db.auditLog.count({ where: { action: 'DISPUTE_STATUS_CHANGED', targetId: d.id } })).toBe(1);
  });

  it('DISMISSED is reachable only from UNDER_REVIEW', async () => {
    const orderId = await orderIn('COMPLETED', customer, master);
    const d = (await h.post('/disputes', customer.token, body(orderId))).data;
    expect((await h.patch(`/disputes/${d.id}/status`, admin.token, { status: 'DISMISSED' })).status).toBe(409);
    await h.patch(`/disputes/${d.id}/status`, admin.token, { status: 'UNDER_REVIEW' });
    expect((await h.patch(`/disputes/${d.id}/status`, admin.token, { status: 'DISMISSED', decision: 'No fault' })).data.status).toBe('DISMISSED');
  });
});

describe('M07 — reviews & rating aggregation', () => {
  let master: TestMaster;
  let bystander: TestUser;

  beforeAll(async () => {
    master = await createMaster(h, service.id);
    bystander = await createUser(h, ['CUSTOMER']);
  });

  async function review(rating: number, comment?: string, over: { customer?: TestUser; status?: 'COMPLETED' | 'BOOKED' } = {}) {
    const customer = over.customer ?? (await createUser(h, ['CUSTOMER']));
    const orderId = await orderIn(over.status ?? 'COMPLETED', customer, master);
    const res = await h.post('/reviews', customer.token, { orderId, rating, comment });
    return { res, customer, orderId };
  }

  const stored = () => h.db.masterProfile.findUniqueOrThrow({ where: { id: master.masterId } });

  it('only the customer of a COMPLETED order may review, once', async () => {
    const notDone = await review(5, 'nice', { status: 'BOOKED' });
    expect(notDone.res.status).toBe(400);

    const { res, customer, orderId } = await review(5, 'Great');
    expect(res.status).toBe(201);
    expect(res.data.status).toBe('PUBLISHED');

    expect((await h.post('/reviews', customer.token, { orderId, rating: 4 })).status).toBe(409);
    expect((await h.post('/reviews', bystander.token, { orderId, rating: 1, comment: 'spite' })).status).toBe(403);
    expect((await h.post('/reviews', master.token, { orderId, rating: 5 })).status).toBe(403);
    expect((await h.post('/reviews', customer.token, { orderId: MISSING_UUID, rating: 4 })).status).toBe(404);
  });

  it('validates rating and body shape', async () => {
    const customer = await createUser(h, ['CUSTOMER']);
    const orderId = await orderIn('COMPLETED', customer, master);
    for (const bad of [{ rating: 0 }, { rating: 6 }, { rating: 5.5 }, { rating: 3.3 }, { rating: 0.25 }, { rating: 4, comment: 'x'.repeat(2001) }, { rating: 4, masterProfileId: master.masterId }, {}]) {
      expect((await h.post('/reviews', customer.token, { orderId, ...bad })).status).toBe(400);
    }
    expect(await h.db.review.count({ where: { orderId } })).toBe(0);
  });

  it('accepts half-star ratings (0.5 steps) and stores them exactly', async () => {
    const { res, orderId } = await review(4.5, 'Deyarli a’lo');
    expect(res.status).toBe(201);
    expect(res.data.rating).toBe(4.5);
    expect((await h.db.review.findUniqueOrThrow({ where: { orderId } })).rating).toBe(4.5);
    const low = await review(0.5, 'Juda yomon');
    expect(low.res.status).toBe(201);
    expect(low.res.data.rating).toBe(0.5);
    const bare = await review(0.5);
    expect(bare.res.status).toBe(201);
    expect(bare.res.data.status).toBe('FLAGGED');
  });

  it('a concurrent double-submit yields exactly one review', async () => {
    const customer = await createUser(h, ['CUSTOMER']);
    const orderId = await orderIn('COMPLETED', customer, master);
    const results = await Promise.all(Array.from({ length: 5 }, () => h.post('/reviews', customer.token, { orderId, rating: 5, comment: 'x' })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
  });

  it('recomputes ratingAvg/ratingCount from PUBLISHED reviews only; FLAGGED (bare 1-star) is excluded everywhere', async () => {
    const fresh = await createMaster(h, service.id);
    const rate = async (rating: number, comment?: string) => {
      const c = await createUser(h, ['CUSTOMER']);
      const o = await bookOrder(h, c, fresh, service.id);
      await h.db.order.update({ where: { id: o.orderId }, data: { status: 'COMPLETED' } });
      return h.post('/reviews', c.token, { orderId: o.orderId, rating, comment });
    };
    await rate(5, 'a');
    await rate(4, 'b');
    await rate(3, 'c');
    let m = await h.db.masterProfile.findUniqueOrThrow({ where: { id: fresh.masterId } });
    expect(Number(m.ratingAvg)).toBe(4);
    expect(m.ratingCount).toBe(3);

    const flagged = await rate(1);
    expect(flagged.data.status).toBe('FLAGGED');
    m = await h.db.masterProfile.findUniqueOrThrow({ where: { id: fresh.masterId } });
    expect(Number(m.ratingAvg)).toBe(4);
    expect(m.ratingCount).toBe(3);

    const listing = await h.get(`/reviews?masterId=${fresh.masterId}&limit=50`, bystander.token);
    expect(listing.data.items).toHaveLength(3);
    expect(listing.data.items.map((r: any) => r.rating).sort()).toEqual([3, 4, 5]);
    expect((await h.get(`/reviews/${flagged.data.id}`, bystander.token)).status).toBe(404);

    const commented = await rate(1, 'Never showed up');
    expect(commented.data.status).toBe('PUBLISHED');
    m = await h.db.masterProfile.findUniqueOrThrow({ where: { id: fresh.masterId } });
    expect(m.ratingCount).toBe(4);
    expect(Number(m.ratingAvg)).toBe(3.25);
  });

  it('public listing is paginated and does not expose the author’s contact data', async () => {
    await review(5, 'p1');
    await review(4, 'p2');
    await review(3, 'p3');
    const p1 = await h.get(`/reviews?masterId=${master.masterId}&limit=2`, bystander.token);
    expect(p1.data.items).toHaveLength(2);
    expect(p1.data.nextCursor).toBeTruthy();
    const p2 = await h.get(`/reviews?masterId=${master.masterId}&limit=2&cursor=${p1.data.nextCursor}`, bystander.token);
    const ids = [...p1.data.items, ...p2.data.items].map((r: any) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(JSON.stringify(p1.body)).not.toMatch(/phone|email/);
    expect((await h.get('/reviews', bystander.token)).status).toBe(400);
    expect((await h.get('/reviews?masterId=nope', bystander.token)).status).toBe(400);
    expect((await h.get(`/reviews?masterId=${MISSING_UUID}`, bystander.token)).data.items).toEqual([]);
    expect((await h.get(`/reviews/${MISSING_UUID}`, bystander.token)).status).toBe(404);
    expect((await h.get(`/reviews?masterId=${master.masterId}`)).status).toBe(401);
    expect(Number((await stored()).ratingCount)).toBeGreaterThan(0);
  });
});

describe('M08/M09 — admin dashboard & revenue report', () => {
  let customer: TestUser;
  let master: TestMaster;

  beforeAll(async () => {
    customer = await createUser(h, ['CUSTOMER']);
    master = await createMaster(h, service.id);
  });

  it('is ADMIN-only', async () => {
    for (const path of ['/admin/dashboard', '/admin/reports']) {
      expect((await h.get(path)).status).toBe(401);
      expect((await h.get(path, customer.token)).status).toBe(403);
      expect((await h.get(path, master.token)).status).toBe(403);
      expect((await h.get(path, admin.token)).status).toBe(200);
    }
  });

  it('dashboard counts equal what is really in the database', async () => {
    const dash = (await h.get('/admin/dashboard', admin.token)).data;
    // «Foydalanuvchilar» = mijoz va ustalar; admin akkauntlari hisobga kirmaydi («Foydalanuvchilar» sahifasi bilan bir xil).
    expect(dash.users.total).toBe(await h.db.user.count({ where: { userRoles: { some: { role: { in: ['CUSTOMER', 'MASTER'] } } } } }));
    expect(dash.masters.total).toBe(await h.db.masterProfile.count());
    expect(dash.requests.total).toBe(await h.db.problemRequest.count());
    expect(dash.orders.total).toBe(await h.db.order.count());
    expect(dash.bookings.total).toBe(await h.db.booking.count());
    expect(dash.disputes.total).toBe(await h.db.case.count({ where: { type: 'DISPUTE' } }));
    const byStatus = await h.db.order.groupBy({ by: ['status'], _count: true });
    for (const row of byStatus) expect(dash.orders.byStatus[row.status]).toBe(row._count);
  });

  it('dashboard rating excludes FLAGGED reviews', async () => {
    const published = await h.db.review.aggregate({ _avg: { rating: true }, _count: true, where: { status: 'PUBLISHED' } });
    const all = await h.db.review.aggregate({ _avg: { rating: true }, _count: true });
    expect(all._count).toBeGreaterThan(published._count);
    const dash = (await h.get('/admin/dashboard', admin.token)).data;
    expect(dash.reviews.total).toBe(published._count);
    expect(dash.reviews.averageRating).toBeCloseTo(published._avg.rating ?? 0, 5);
  });

  it('revenue report: gross / refunded / net match the ledger and keep refunded payments in', async () => {
    const before = (await h.get('/admin/reports', admin.token)).data.summary;
    const o1 = await bookOrder(h, customer, master, service.id, { price: 500000 });
    const o2 = await bookOrder(h, customer, master, service.id, { price: 300000 });
    const p1 = (await payOrder(h, customer, o1.orderId)).payment;
    await payOrder(h, customer, o2.orderId);
    await h.post(`/payments/${p1.id}/refund`, admin.token, { amount: 500000, reason: 'CUSTOMER_REQUEST', note: 'full refund' }, { idempotent: true });
    const after = (await h.get('/admin/reports', admin.token)).data.summary;

    expect(Number(after.totalRevenue) - Number(before.totalRevenue)).toBe(800000);
    expect(Number(after.totalRefunded) - Number(before.totalRefunded)).toBe(500000);
    expect(Number(after.netRevenue) - Number(before.netRevenue)).toBe(300000);
    expect(after.totalPayments - before.totalPayments).toBe(2);

    const ledger = await h.db.payment.aggregate({ where: { status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } }, _sum: { amount: true, refundedAmount: true } });
    expect(Number(after.totalRevenue)).toBe(Number(ledger._sum.amount));
    expect(Number(after.netRevenue)).toBe(Number(ledger._sum.amount) - Number(ledger._sum.refundedAmount));
    expect(after.totalOrders).toBe(await h.db.order.count());
    expect(after.completedOrders).toBe(await h.db.order.count({ where: { status: 'COMPLETED' } }));
    expect(after.disputeCount).toBe(await h.db.case.count({ where: { type: 'DISPUTE' } }));
  });

  it('date filters narrow the report; bad input is 400; pagination works', async () => {
    const future = encodeURIComponent(new Date(Date.now() + 86_400_000).toISOString());
    const empty = (await h.get(`/admin/reports?dateFrom=${future}`, admin.token)).data;
    expect(Number(empty.summary.totalRevenue)).toBe(0);
    expect(empty.items).toEqual([]);
    expect((await h.get('/admin/reports?dateFrom=tomorrow', admin.token)).status).toBe(400);
    expect((await h.get('/admin/dashboard?dateTo=nope', admin.token)).status).toBe(400);
    const p1 = await h.get('/admin/reports?limit=1', admin.token);
    expect(p1.data.items).toHaveLength(1);
    const p2 = await h.get(`/admin/reports?limit=1&cursor=${p1.data.nextCursor}`, admin.token);
    expect(p2.data.items[0].id).not.toBe(p1.data.items[0].id);
    const todayOnly = (await h.get(`/admin/dashboard?dateFrom=${encodeURIComponent(new Date(Date.now() - 3_600_000).toISOString())}`, admin.token)).data;
    expect(todayOnly.users.total).toBeGreaterThan(0);
    void uploadImage;
  });
});
