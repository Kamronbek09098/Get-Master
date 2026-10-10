import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createMaster, createUser, freshService, type Harness, payOrder, type TestMaster, type TestUser, uploadImage, waitFor, soon } from '../helpers/harness';

let h: Harness;
let service: { id: string; categoryId: string };
let customer: TestUser;
let master: TestMaster;
let bystander: TestMaster;

const ids: Record<string, string> = {};
const step = async <T>(_name: string, fn: () => Promise<T>) => fn();

beforeAll(async () => {
  h = await bootHarness();
  service = await freshService(h);
  customer = await createUser(h, ['CUSTOMER'], { firstName: 'Journey' });
  master = await createMaster(h, service.id, { latitude: 41.31, longitude: 69.28, workRadiusKm: 40, firstName: 'Ustoz' });
  bystander = await createMaster(h, service.id, { latitude: 41.30, longitude: 69.27, workRadiusKm: 40, firstName: 'Silent' });
  for (let day = 0; day < 7; day += 1) {
    const res = await h.post('/masters/me/availability', master.token, { dayOfWeek: day, startTime: '08:00', endTime: '20:00' });
    expect(res.status).toBe(201);
  }
});
afterAll(async () => {
  await h.close();
});

describe('end-to-end: request → … → review → statistics', () => {
  it('1. customer creates and submits a request', async () => {
    const created = await h.post('/problem-requests', customer.token, {
      preferredStartAt: soon(),
      title: 'Kran oqyapti',
      description: 'Oshxonadagi kran tunda ham tomchilab oqmoqda, tezroq ko‘rib chiqish kerak.',
      serviceId: service.id,
      latitude: 41.311,
      longitude: 69.279,
    });
    expect(created.status).toBe(201);
    ids.request = created.data.id;
    const submitted = await h.post(`/problem-requests/${ids.request}/submit`, customer.token);
    expect(submitted.data.status).toBe('SUBMITTED');
    expect(await h.db.outboxEvent.count({ where: { eventName: 'classification.requested', aggregateId: ids.request } })).toBe(1);
  });

  it('2. outbox → BullMQ → classification (fallback, no AI) → matching → wave-1 notification', async () => {
    const classification = await waitFor(async () => h.db.aIClassification.findFirst({ where: { requestId: ids.request } }), { label: 'classification' });
    expect(classification.confidence).toBeNull();
    const run = await waitFor(async () => h.db.matchingRun.findFirst({ where: { requestId: ids.request, status: 'COMPLETED' } }), { label: 'matching' });
    const results = await h.db.matchingResult.findMany({ where: { runId: run.id }, orderBy: { score: 'desc' } });
    expect(results.map((r) => r.masterId)).toEqual(expect.arrayContaining([master.masterId, bystander.masterId]));
    const note = await waitFor(async () => h.db.notification.findFirst({ where: { userId: master.id, template: 'matching.wave' } }), { label: 'wave notification' });
    expect((note.data as any).requestId).toBe(ids.request);
    await waitFor(async () => (await h.db.outboxEvent.findFirst({ where: { eventName: 'classification.requested', aggregateId: ids.request } }))?.status === 'PUBLISHED', { label: 'classification event published' });
    expect((await h.db.problemRequest.findUniqueOrThrow({ where: { id: ids.request } })).status).toBe('MATCHING');
    expect(Number((await h.db.masterProfile.findUniqueOrThrow({ where: { id: master.masterId } })).responseRate)).toBe(0);
  });

  it('3. master answers with an offer inside their working hours → responseRate updates; request → OFFERS_RECEIVED', async () => {
    const slot = new Date(Date.now() + 2 * 86_400_000);
    slot.setUTCHours(7, 0, 0, 0);
    const offer = await h.post('/offers', master.token, { requestId: ids.request, price: 180000, estimatedMinutes: 90, availableAt: slot.toISOString(), message: 'Ertaga kelaman' });
    expect(offer.status).toBe(201);
    ids.offer = offer.data.id;
    expect((await h.db.problemRequest.findUniqueOrThrow({ where: { id: ids.request } })).status).toBe('OFFERS_RECEIVED');
    const stats = await h.db.masterProfile.findUniqueOrThrow({ where: { id: master.masterId } });
    expect(Number(stats.responseRate)).toBe(100);
    const silent = await h.db.masterProfile.findUniqueOrThrow({ where: { id: bystander.masterId } });
    expect(Number(silent.responseRate)).toBe(0);
    const listed = await h.get(`/problem-requests/${ids.request}/offers`, customer.token);
    expect(listed.data.items.map((o: any) => o.id)).toEqual([ids.offer]);
  });

  it('4. customer accepts (idempotent) → booking, order, conversation and outbox event exist atomically', async () => {
    const key = 'journey-accept-1';
    const send = () => h.api('POST', `/offers/${ids.offer}/accept`, { token: customer.token, headers: { 'idempotency-key': key } });
    const first = await send();
    expect(first.status).toBe(201);
    const replay = await send();
    expect(replay.data.order.id).toBe(first.data.order.id);
    ids.order = first.data.order.id;
    ids.booking = first.data.booking.id;
    expect(first.data.order.status).toBe('BOOKED');
    expect(Number(first.data.order.finalAmount)).toBe(180000);
    expect(await h.db.order.count({ where: { booking: { requestId: ids.request } } })).toBe(1);
    ids.conversation = (await h.db.conversation.findUniqueOrThrow({ where: { orderId: ids.order } })).id;
    expect((await h.db.problemRequest.findUniqueOrThrow({ where: { id: ids.request } })).status).toBe('BOOKED');
  });

  it('5. both sides chat; attachments and notifications flow', async () => {
    const C = `/conversations/${ids.conversation}`;
    expect((await h.post(`${C}/messages`, customer.token, { text: 'Assalomu alaykum, manzil: Chilonzor 5' })).status).toBe(201);
    const photo = await uploadImage(h, master.token, 'MESSAGE_ATTACHMENT', 'Conversation', ids.conversation, 100);
    expect((await h.post(`${C}/messages`, master.token, { text: 'Kelyapman', mediaAssetIds: [photo] })).data.type).toBe('IMAGE');
    expect((await h.get(`${C}/messages`, customer.token)).data.items).toHaveLength(2);
    await waitFor(async () => h.db.notification.findFirst({ where: { userId: customer.id, template: 'chat.message' } }), { label: 'chat notification' });
  });

  it('6. master travels, arrives, uploads BEFORE proof, starts work, uploads AFTER proof, submits', async () => {
    const O = `/orders/${ids.order}`;
    for (const path of ['confirm', 'start-travel', 'arrive']) expect((await h.post(`${O}/${path}`, master.token)).status).toBe(201);
    const before = await uploadImage(h, master.token, 'WORK_PROOF', 'Order', ids.order, 101);
    expect((await h.post(`${O}/work-proofs`, master.token, { stage: 'BEFORE', mediaAssetId: before })).status).toBe(201);
    // Ish "ertaga" (2 kundan keyin) belgilangan edi — real hayotda usta shu vaqt kelgach boshlaydi; testda vaqtni simulyatsiya qilamiz.
    await h.db.booking.update({ where: { id: ids.booking }, data: { scheduledStartAt: new Date(Date.now() - 1000) } });
    expect((await h.post(`${O}/start-work`, master.token)).data.status).toBe('IN_PROGRESS');
    const after = await uploadImage(h, master.token, 'WORK_PROOF', 'Order', ids.order, 102);
    expect((await h.post(`${O}/work-proofs`, master.token, { stage: 'AFTER', mediaAssetId: after })).status).toBe(201);
    expect((await h.post(`${O}/submit-completion`, master.token)).data.status).toBe('WAITING_CONFIRMATION');
    const proofs = (await h.get(`${O}/work-proofs`, customer.token)).data;
    expect(proofs.map((p: any) => p.stage).sort()).toEqual(['AFTER', 'BEFORE']);
  });

  it('7. customer pays in full, then confirms → COMPLETED; master statistics are derived from the real lifecycle', async () => {
    // To'lovsiz tasdiqlab bo'lmaydi: faqat to'lov usulini tanlash yetarli emas.
    const early = await h.post(`/orders/${ids.order}/confirm-completion`, customer.token);
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('PAYMENT_REQUIRED');
    const { payment, hook } = await payOrder(h, customer, ids.order);
    expect(hook.status).toBe(201);
    ids.payment = payment.id;
    expect((await h.post(`/orders/${ids.order}/confirm-completion`, customer.token)).data.status).toBe('COMPLETED');
    const stats = await h.db.masterProfile.findUniqueOrThrow({ where: { id: master.masterId } });
    expect(stats.completedOrders).toBe(1);
    expect(Number(stats.completionRate)).toBe(100);
    expect(Number(stats.cancellationRate)).toBe(0);
    expect(Number(stats.responseRate)).toBe(100);
  });

  it('8. payment: create → signed provider webhook → SUCCEEDED; earnings and history agree', async () => {
    expect((await h.db.payment.findUniqueOrThrow({ where: { id: ids.payment } })).status).toBe('SUCCEEDED');
    const earnings = (await h.get('/payments/earnings', master.token)).data.summary;
    expect(Number(earnings.grossAmount)).toBe(180000);
    expect((await h.get('/payments/history', customer.token)).data.items.map((p: any) => p.id)).toContain(ids.payment);
  });

  it('9. customer reviews → master rating is aggregated', async () => {
    const review = await h.post('/reviews', customer.token, { orderId: ids.order, rating: 5, comment: 'Juda yaxshi usta' });
    expect(review.status).toBe(201);
    const stats = await h.db.masterProfile.findUniqueOrThrow({ where: { id: master.masterId } });
    expect(Number(stats.ratingAvg)).toBe(5);
    expect(stats.ratingCount).toBe(1);
    const page = await h.get(`/masters/${master.masterId}`, customer.token);
    expect(Number(page.data.ratingAvg)).toBe(5);
    expect(page.data.completedOrders).toBe(1);
  });

  it('10. every domain event was delivered exactly once through the outbox → BullMQ pipeline', async () => {
    const aggregateIds = [ids.request, ids.order, ids.payment];
    await waitFor(async () => (await h.db.outboxEvent.count({ where: { aggregateId: { in: aggregateIds }, status: { in: ['PENDING'] }, availableAt: { lte: new Date() } } })) === 0, { label: 'outbox drained', timeoutMs: 30_000 });
    const events = await h.db.outboxEvent.findMany({ where: { aggregateId: { in: aggregateIds } } });
    const names = events.map((e) => e.eventName);
    expect(names).toEqual(expect.arrayContaining(['classification.requested', 'order.booked', 'order.status_changed', 'payment.succeeded']));
    expect(events.filter((e) => e.availableAt <= new Date()).every((e) => e.status === 'PUBLISHED')).toBe(true);
    expect(events.every((e) => e.status !== 'FAILED')).toBe(true);

    const mapped = events.filter((e) => ['order.booked', 'order.status_changed', 'payment.succeeded'].includes(e.eventName));
    for (const e of mapped) {
      expect(await h.db.notification.count({ where: { data: { path: ['outboxEventId'], equals: e.id } } }), e.eventName).toBe(1);
    }
    expect(await h.db.notification.count({ where: { userId: master.id, template: 'order.booked' } })).toBe(1);
    expect(await h.db.notification.count({ where: { userId: customer.id, template: 'payment.succeeded' } })).toBe(1);
    expect(await h.db.notification.count({ where: { template: 'order.status_changed', userId: { in: [customer.id, master.id] } } })).toBe(6);
  });

  it('11. audit trail & ledger are consistent with the journey', async () => {
    const history = await h.db.orderStatusHistory.findMany({ where: { orderId: ids.order }, orderBy: { createdAt: 'asc' } });
    expect(history.map((x) => x.newStatus)).toEqual(['BOOKED', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'WAITING_CONFIRMATION', 'COMPLETED']);
    expect(await h.db.paymentWebhookEvent.count({ where: { processedAt: { not: null } } })).toBeGreaterThanOrEqual(1);
    const order = await h.db.order.findUniqueOrThrow({ where: { id: ids.order } });
    expect(order.completedAt).not.toBeNull();
    expect(Number(order.finalAmount)).toBe(180000);
    void step;
  });
});
