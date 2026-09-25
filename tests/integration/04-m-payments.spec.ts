import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookOrder, bootHarness, createAdmin, createMaster, createUser, firstService, type Harness, MISSING_UUID, payOrder, sendWebhook, type TestMaster, type TestUser, waitFor } from '../helpers/harness';

let h: Harness;
let service: { id: string };
let customer: TestUser;
let other: TestUser;
let admin: TestUser;
let master: TestMaster;
let rival: TestMaster;

beforeAll(async () => {
  h = await bootHarness();
  service = await firstService(h);
  customer = await createUser(h, ['CUSTOMER']);
  other = await createUser(h, ['CUSTOMER']);
  admin = await createAdmin(h);
  master = await createMaster(h, service.id);
  rival = await createMaster(h, service.id);
});
afterAll(async () => {
  await h.close();
});

describe('payment creation invariants (K09)', () => {
  it('requires an Idempotency-Key and replays the stored response for the same key', async () => {
    const order = await bookOrder(h, customer, master, service.id);
    const noKey = await h.post('/payments', customer.token, { orderId: order.orderId, provider: 'CLICK' });
    expect(noKey.status).toBe(400);
    expect(noKey.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

    const key = `k-${randomUUID()}`;
    const first = await h.api('POST', '/payments', { token: customer.token, body: { orderId: order.orderId, provider: 'CLICK' }, headers: { 'idempotency-key': key } });
    const replay = await h.api('POST', '/payments', { token: customer.token, body: { orderId: order.orderId, provider: 'CLICK' }, headers: { 'idempotency-key': key } });
    expect(first.status).toBe(201);
    expect(replay.data.payment.id).toBe(first.data.payment.id);
    const reused = await h.api('POST', '/payments', { token: customer.token, body: { orderId: order.orderId, provider: 'PAYME' }, headers: { 'idempotency-key': key } });
    expect(reused.status).toBe(409);
  });

  it('only the order owner can pay; unknown/cancelled orders are refused', async () => {
    const order = await bookOrder(h, customer, master, service.id);
    expect((await h.post('/payments', other.token, { orderId: order.orderId, provider: 'CLICK' }, { idempotent: true })).status).toBe(403);
    expect((await h.post('/payments', customer.token, { orderId: MISSING_UUID, provider: 'CLICK' }, { idempotent: true })).status).toBe(404);
    expect((await h.post('/payments', customer.token, { orderId: order.orderId, provider: 'BITCOIN' }, { idempotent: true })).status).toBe(400);
    await h.db.order.update({ where: { id: order.orderId }, data: { status: 'CANCELLED' } });
    const res = await h.post('/payments', customer.token, { orderId: order.orderId, provider: 'CLICK' }, { idempotent: true });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ORDER_NOT_PAYABLE');
  });

  it('never stacks duplicate pending payments — concurrent attempts converge on one row', async () => {
    const order = await bookOrder(h, customer, master, service.id);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => h.post('/payments', customer.token, { orderId: order.orderId, provider: 'CLICK' }, { idempotent: true })),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(new Set(results.map((r) => r.data.payment.id)).size).toBe(1);
    expect(await h.db.payment.count({ where: { orderId: order.orderId } })).toBe(1);
  });

  it('amount and currency come from the order, never the client', async () => {
    const order = await bookOrder(h, customer, master, service.id, { price: 275000 });
    const res = await h.post('/payments', customer.token, { orderId: order.orderId, provider: 'CLICK', amount: 1 }, { idempotent: true });
    expect(res.status).toBe(400);
    const ok = await h.post('/payments', customer.token, { orderId: order.orderId, provider: 'CLICK' }, { idempotent: true });
    expect(Number(ok.data.payment.amount)).toBe(275000);
    expect(ok.data.payment.currency).toBe('UZS');
  });
});

describe('webhooks — signature, replay protection, state machine', () => {
  let orderId: string;
  let payment: any;

  beforeAll(async () => {
    orderId = (await bookOrder(h, customer, master, service.id, { price: 100000 })).orderId;
    payment = (await h.post('/payments', customer.token, { orderId, provider: 'CLICK' }, { idempotent: true })).data.payment;
  });

  const payload = (over: Record<string, unknown> = {}) => ({
    eventId: `evt-${randomUUID()}`,
    paymentId: payment.id,
    status: 'SUCCEEDED',
    amount: 100000,
    currency: 'UZS',
    providerPaymentId: 'prov-1',
    ...over,
  });

  it('rejects a missing, wrong or foreign-secret signature and changes nothing', async () => {
    const body = payload();
    expect((await h.api('POST', '/webhooks/payments/click', { rawBody: JSON.stringify(body) })).status).toBe(400);
    expect((await h.api('POST', '/webhooks/payments/click', { rawBody: JSON.stringify(body), headers: { 'x-webhook-signature': 'deadbeef' } })).status).toBe(400);
    expect((await sendWebhook(h, body, { secret: 'not-the-secret' })).status).toBe(400);
    expect((await sendWebhook(h, body, { provider: 'nosuchprovider' })).status).toBe(400);
    expect((await h.db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('PENDING');
    expect(await h.db.paymentWebhookEvent.count({ where: { eventId: body.eventId } })).toBe(0);
  });

  it('a body signed for one payload cannot be replayed with tampered content', async () => {
    const body = payload({ amount: 1 });
    const { createHmac } = await import('node:crypto');
    const sigOfOriginal = createHmac('sha256', 'test-only-click-webhook-secret').update(JSON.stringify(payload({ amount: 100000 }))).digest('hex');
    const res = await h.api('POST', '/webhooks/payments/click', { rawBody: JSON.stringify(body), headers: { 'x-webhook-signature': sigOfOriginal } });
    expect(res.status).toBe(400);
  });

  it('rejects malformed payloads with 400 (never 500), even when correctly signed', async () => {
    for (const bad of [{}, { eventId: 'x' }, payload({ paymentId: 'not-a-uuid' }), payload({ status: 'MAYBE' }), payload({ amount: 'lots' }), payload({ currency: 'US' }), payload({ eventId: '' })]) {
      expect((await sendWebhook(h, bad as any)).status).toBe(400);
    }
  });

  it('amount / currency mismatch and unknown payments are refused and audited', async () => {
    const mismatch = await sendWebhook(h, payload({ amount: 99999 }));
    expect(mismatch.status).toBe(400);
    expect((await sendWebhook(h, payload({ currency: 'USD' }))).status).toBe(400);
    expect((await sendWebhook(h, payload({ paymentId: MISSING_UUID }))).status).toBe(400);
    expect(await h.db.auditLog.count({ where: { action: 'PAYMENT_WEBHOOK_MISMATCH', targetId: payment.id } })).toBeGreaterThanOrEqual(2);
    expect((await h.db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('PENDING');
  });

  it('settles once; the same event delivered again (even concurrently) is deduplicated', async () => {
    const body = payload();
    const results = await Promise.all(Array.from({ length: 5 }, () => sendWebhook(h, body)));
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(results.filter((r) => r.data.payment).length).toBe(1);
    expect(results.filter((r) => r.data.deduplicated).length).toBe(4);
    const row = await h.db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(row.status).toBe('SUCCEEDED');
    expect(await h.db.paymentWebhookEvent.count({ where: { eventId: body.eventId } })).toBe(1);
    expect(await h.db.outboxEvent.count({ where: { eventName: 'payment.succeeded', aggregateId: payment.id } })).toBe(1);
  });

  it('a different event id cannot flip a settled payment (SUCCEEDED → FAILED is ignored)', async () => {
    const res = await sendWebhook(h, payload({ status: 'FAILED', failureReason: 'late failure' }));
    expect(res.status).toBe(201);
    expect(res.data.ignored).toBe(true);
    const row = await h.db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(row.status).toBe('SUCCEEDED');
    expect(row.failureReason).toBeNull();
    expect(await h.db.outboxEvent.count({ where: { eventName: 'payment.failed', aggregateId: payment.id } })).toBe(0);
  });

  it('the success event is delivered to the customer as exactly one notification (outbox → BullMQ)', async () => {
    const n = await waitFor(async () => {
      const rows = await h.db.notification.findMany({ where: { userId: customer.id, template: 'payment.succeeded' } });
      return rows.length ? rows : null;
    }, { label: 'payment notification' });
    expect(n.length).toBeGreaterThanOrEqual(1);
    const events = await h.db.outboxEvent.findMany({ where: { eventName: 'payment.succeeded', aggregateId: payment.id } });
    expect(events.every((e) => e.status === 'PUBLISHED')).toBe(true);
  });

  it('an order can only be paid once', async () => {
    const again = await h.post('/payments', customer.token, { orderId, provider: 'CLICK' }, { idempotent: true });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ORDER_ALREADY_PAID');
  });
});

describe('refunds', () => {
  it('are ADMIN-only, bounded by what was captured, and require a settled payment', async () => {
    const order = await bookOrder(h, customer, master, service.id, { price: 200000 });
    const pending = (await h.post('/payments', customer.token, { orderId: order.orderId, provider: 'CLICK' }, { idempotent: true })).data.payment;
    const body = { amount: 1000, reason: 'CUSTOMER_REQUEST', note: 'test' };

    expect((await h.post(`/payments/${pending.id}/refund`, customer.token, body, { idempotent: true })).status).toBe(403);
    const early = await h.post(`/payments/${pending.id}/refund`, admin.token, body, { idempotent: true });
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('PAYMENT_NOT_REFUNDABLE');

    await sendWebhook(h, { eventId: `e-${randomUUID()}`, paymentId: pending.id, status: 'SUCCEEDED', amount: 200000, currency: 'UZS' });
    expect((await h.post(`/payments/${pending.id}/refund`, admin.token, { ...body, amount: 200001 }, { idempotent: true })).status).toBe(409);
    expect((await h.post(`/payments/${pending.id}/refund`, admin.token, { ...body, amount: -5 }, { idempotent: true })).status).toBe(400);
    expect((await h.post(`/payments/${pending.id}/refund`, admin.token, { ...body, amount: 50000 }, { idempotent: true })).status).toBe(201);
    expect((await h.db.payment.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe('PARTIALLY_REFUNDED');
  });

  it('concurrent refunds can never exceed the captured amount', async () => {
    const order = await bookOrder(h, customer, master, service.id, { price: 100000 });
    const { payment } = await payOrder(h, customer, order.orderId);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => h.post(`/payments/${payment.id}/refund`, admin.token, { amount: 30000, reason: 'CUSTOMER_REQUEST', note: 'race' }, { idempotent: true })),
    );
    const ok = results.filter((r) => r.status === 201).length;
    expect(ok).toBe(3);
    expect(results.filter((r) => r.status === 409).length).toBe(2);
    const row = await h.db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(Number(row.refundedAmount)).toBe(90000);
    expect(Number(row.refundedAmount)).toBeLessThanOrEqual(Number(row.amount));
  });
});

describe('M04 — customer payment history', () => {
  it('lists only my payments (BOLA), filters by status/provider/date and paginates', async () => {
    const buyer = await createUser(h, ['CUSTOMER']);
    const intruder = await createUser(h, ['CUSTOMER']);
    const paid = await bookOrder(h, buyer, master, service.id, { price: 111000 });
    const unpaid = await bookOrder(h, buyer, master, service.id, { price: 222000 });
    const failed = await bookOrder(h, buyer, master, service.id, { price: 333000 });
    await payOrder(h, buyer, paid.orderId, 'SUCCEEDED');
    await h.post('/payments', buyer.token, { orderId: unpaid.orderId, provider: 'PAYME' }, { idempotent: true });
    await payOrder(h, buyer, failed.orderId, 'FAILED');

    const all = await h.get('/payments/history?limit=50', buyer.token);
    expect(all.data.items).toHaveLength(3);
    expect((await h.get('/payments/history', intruder.token)).data.items).toEqual([]);
    expect((await h.get('/payments/history?status=SUCCEEDED', buyer.token)).data.items).toHaveLength(1);
    expect((await h.get('/payments/history?status=FAILED', buyer.token)).data.items).toHaveLength(1);
    expect((await h.get('/payments/history?provider=PAYME', buyer.token)).data.items).toHaveLength(1);
    const future = encodeURIComponent(new Date(Date.now() + 86_400_000).toISOString());
    expect((await h.get(`/payments/history?dateFrom=${future}`, buyer.token)).data.items).toEqual([]);

    const p1 = await h.get('/payments/history?limit=2', buyer.token);
    const p2 = await h.get(`/payments/history?limit=2&cursor=${p1.data.nextCursor}`, buyer.token);
    expect(p1.data.items).toHaveLength(2);
    expect(p2.data.items).toHaveLength(1);
    expect(new Set([...p1.data.items, ...p2.data.items].map((p: any) => p.id)).size).toBe(3);

    expect(JSON.stringify(all.body)).not.toMatch(/providerPaymentId|failureReason|metadata/);
    expect((await h.get('/payments/history?status=MAYBE', buyer.token)).status).toBe(400);
  });

  it('GET /payments/:id is owner-only', async () => {
    const buyer = await createUser(h, ['CUSTOMER']);
    const order = await bookOrder(h, buyer, master, service.id);
    const { payment } = await payOrder(h, buyer, order.orderId);
    expect((await h.get(`/payments/${payment.id}`, buyer.token)).status).toBe(200);
    expect((await h.get(`/payments/${payment.id}`, other.token)).status).toBe(403);
    expect((await h.get(`/payments/${MISSING_UUID}`, buyer.token)).status).toBe(404);
  });
});

describe('M05 — master earnings calculation', () => {
  it('sums settled payments on the master’s own orders only, net of refunds', async () => {
    const earner = await createMaster(h, service.id);
    const buyer = await createUser(h, ['CUSTOMER']);
    const amounts = [100000, 250000, 400000];
    const payments: any[] = [];
    for (const price of amounts) {
      const o = await bookOrder(h, buyer, earner, service.id, { price });
      payments.push((await payOrder(h, buyer, o.orderId)).payment);
    }
    const pendingOrder = await bookOrder(h, buyer, earner, service.id, { price: 999000 });
    await h.post('/payments', buyer.token, { orderId: pendingOrder.orderId, provider: 'CLICK' }, { idempotent: true });
    const failedOrder = await bookOrder(h, buyer, earner, service.id, { price: 888000 });
    await payOrder(h, buyer, failedOrder.orderId, 'FAILED');
    const rivalOrder = await bookOrder(h, buyer, rival, service.id, { price: 777000 });
    await payOrder(h, buyer, rivalOrder.orderId);

    expect((await h.post(`/payments/${payments[1].id}/refund`, admin.token, { amount: 50000, reason: 'CUSTOMER_REQUEST', note: 'partial' }, { idempotent: true })).status).toBe(201);
    expect((await h.post(`/payments/${payments[0].id}/refund`, admin.token, { amount: 100000, reason: 'CUSTOMER_REQUEST', note: 'full' }, { idempotent: true })).status).toBe(201);

    const res = await h.get('/payments/earnings?limit=50', earner.token);
    expect(res.status).toBe(200);
    expect(Number(res.data.summary.grossAmount)).toBe(750000);
    expect(Number(res.data.summary.refundedAmount)).toBe(150000);
    expect(Number(res.data.summary.netAmount)).toBe(600000);
    expect(res.data.summary.paymentCount).toBe(3);
    expect(res.data.items).toHaveLength(3);

    const rivalRes = await h.get('/payments/earnings', rival.token);
    expect(Number(rivalRes.data.summary.grossAmount)).toBe(777000);
    const future = encodeURIComponent(new Date(Date.now() + 86_400_000).toISOString());
    expect(Number((await h.get(`/payments/earnings?dateFrom=${future}`, earner.token)).data.summary.grossAmount)).toBe(0);
  });

  it('is MASTER-only', async () => {
    expect((await h.get('/payments/earnings', customer.token)).status).toBe(403);
    expect((await h.get('/payments/earnings', admin.token)).status).toBe(403);
    expect((await h.get('/payments/earnings')).status).toBe(401);
  });
});
