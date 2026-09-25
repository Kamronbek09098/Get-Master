import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MediaProcessingService } from '../../src/infrastructure/media/media-processing.service';
import { OutboxProcessor } from '../../src/infrastructure/queue/outbox.processor';
import { QueueService } from '../../src/infrastructure/queue/queue.service';
import { bootHarness, createMaster, createUser, firstService, type Harness, MISSING_UUID, openRequest, type TestMaster, type TestUser, waitFor } from '../helpers/harness';

let h: Harness;
let service: { id: string };
let customer: TestUser;
let stranger: TestUser;

beforeAll(async () => {
  h = await bootHarness();
  service = await firstService(h);
  customer = await createUser(h, ['CUSTOMER']);
  stranger = await createUser(h, ['CUSTOMER']);
});
afterAll(async () => {
  await h.close();
});

const inDays = (days: number, hourUtc = 6) => {
  const d = new Date(Date.now() + days * 86_400_000);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
};

describe('K07 — offers', () => {
  it('only a verified, unpaused master in good standing may bid', async () => {
    const requestId = await openRequest(h, customer, service.id);
    const pending = await createMaster(h, service.id);
    await h.db.masterProfile.update({ where: { id: pending.masterId }, data: { verification: 'PENDING' } });
    const paused = await createMaster(h, service.id);
    await h.db.masterProfile.update({ where: { id: paused.masterId }, data: { isPaused: true } });
    const suspended = await createMaster(h, service.id);
    await h.db.masterProfile.update({ where: { id: suspended.masterId }, data: { status: 'SUSPENDED' } });
    for (const m of [pending, paused, suspended]) {
      expect((await h.post('/offers', m.token, { requestId, price: 1000 })).status).toBe(403);
    }
    expect((await h.post('/offers', customer.token, { requestId, price: 1000 })).status).toBe(403);
    expect(await h.db.offer.count({ where: { requestId } })).toBe(0);
  });

  it('validates the offer and the request state', async () => {
    const m = await createMaster(h, service.id);
    const requestId = await openRequest(h, customer, service.id);
    for (const bad of [{ price: 0 }, { price: -5 }, { price: 'free' }, { price: 100, estimatedMinutes: 0 }, { price: 100, availableAt: 'soon' }, { price: 100, extra: 1 }, {}]) {
      expect((await h.post('/offers', m.token, { requestId, ...bad })).status).toBe(400);
    }
    expect((await h.post('/offers', m.token, { requestId, price: 100, availableAt: '2020-01-01T00:00:00Z' })).status).toBe(400);
    expect((await h.post('/offers', m.token, { requestId, price: 100, expiresAt: '2020-01-01T00:00:00Z' })).status).toBe(400);
    expect((await h.post('/offers', m.token, { requestId: MISSING_UUID, price: 100 })).status).toBe(404);
    const draft = (await h.post('/problem-requests', customer.token, { title: 'Draft one', description: 'still a draft, not open' })).data.id;
    const notOpen = await h.post('/offers', m.token, { requestId: draft, price: 100 });
    expect(notOpen.status).toBe(409);
    expect(notOpen.body.code).toBe('REQUEST_NOT_OPEN_FOR_OFFERS');
  });

  it('one offer per master per request (also under a concurrent burst) and the request moves to OFFERS_RECEIVED', async () => {
    const m = await createMaster(h, service.id);
    const requestId = await openRequest(h, customer, service.id);
    const results = await Promise.all(Array.from({ length: 5 }, () => h.post('/offers', m.token, { requestId, price: 5000 })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect((await h.db.problemRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe('OFFERS_RECEIVED');
  });

  it('visibility: the request owner lists offers; masters see their own; participants only can read one', async () => {
    const a = await createMaster(h, service.id);
    const b = await createMaster(h, service.id);
    const requestId = await openRequest(h, customer, service.id);
    const offerA = (await h.post('/offers', a.token, { requestId, price: 10 })).data.id;
    await h.post('/offers', b.token, { requestId, price: 20 });

    expect((await h.get(`/problem-requests/${requestId}/offers`, customer.token)).data.items).toHaveLength(2);
    expect((await h.get(`/problem-requests/${requestId}/offers`, stranger.token)).status).toBe(403);
    expect((await h.get(`/problem-requests/${requestId}/offers`, a.token)).status).toBe(403);
    expect((await h.get('/offers/mine', a.token)).data.items.map((o: any) => o.id)).toEqual([offerA]);
    expect((await h.get('/offers/mine', customer.token)).status).toBe(403);

    expect((await h.get(`/offers/${offerA}`, customer.token)).status).toBe(200);
    expect((await h.get(`/offers/${offerA}`, a.token)).status).toBe(200);
    expect((await h.get(`/offers/${offerA}`, b.token)).status).toBe(403);
    expect((await h.get(`/offers/${offerA}`, stranger.token)).status).toBe(403);
    expect((await h.get(`/offers/${MISSING_UUID}`, a.token)).status).toBe(404);
    expect(JSON.stringify((await h.get(`/offers/${offerA}`, customer.token)).body)).not.toMatch(/phone|email/);
  });

  it('withdraw: owner only, once; a withdrawn offer cannot be accepted', async () => {
    const m = await createMaster(h, service.id);
    const rival = await createMaster(h, service.id);
    const requestId = await openRequest(h, customer, service.id);
    const offerId = (await h.post('/offers', m.token, { requestId, price: 10 })).data.id;
    expect((await h.post(`/offers/${offerId}/withdraw`, rival.token)).status).toBe(403);
    expect((await h.post(`/offers/${offerId}/withdraw`, m.token)).status).toBe(201);
    expect((await h.post(`/offers/${offerId}/withdraw`, m.token)).status).toBe(409);
    const accept = await h.post(`/offers/${offerId}/accept`, customer.token, undefined, { idempotent: true });
    expect(accept.status).toBe(409);
    expect(accept.body.code).toBe('OFFER_NOT_AVAILABLE');
  });
});

describe('K07/K09 — accept: booking, order invariants, concurrency, idempotency', () => {
  it('requires Idempotency-Key, rejects malformed keys with 400 (never 500), and only the request owner may accept', async () => {
    const m = await createMaster(h, service.id);
    const requestId = await openRequest(h, customer, service.id);
    const offerId = (await h.post('/offers', m.token, { requestId, price: 10 })).data.id;
    expect((await h.post(`/offers/${offerId}/accept`, customer.token)).status).toBe(400);
    for (const key of ['k'.repeat(300), 'has space', 'ключ']) {
      const res = await h.api('POST', `/offers/${offerId}/accept`, { token: customer.token, headers: { 'idempotency-key': key } }).catch(() => null);
      if (res) expect([400], key).toContain(res.status);
    }
    expect((await h.post(`/offers/${offerId}/accept`, stranger.token, undefined, { idempotent: true })).status).toBe(403);
    expect((await h.post(`/offers/${offerId}/accept`, m.token, undefined, { idempotent: true })).status).toBe(403);
    expect((await h.post(`/offers/${MISSING_UUID}/accept`, customer.token, undefined, { idempotent: true })).status).toBe(404);
    expect(await h.db.booking.count({ where: { requestId } })).toBe(0);
  });

  it('creates booking + order + status history + conversation + outbox atomically, snapshotting the offer price', async () => {
    const m = await createMaster(h, service.id);
    const requestId = await openRequest(h, customer, service.id);
    const offerId = (await h.post('/offers', m.token, { requestId, price: 123456, estimatedMinutes: 90 })).data.id;
    const res = await h.post(`/offers/${offerId}/accept`, customer.token, undefined, { idempotent: true });
    expect(res.status).toBe(201);
    const { booking, order } = res.data;
    expect(Number(booking.agreedPrice)).toBe(123456);
    expect(order.status).toBe('BOOKED');
    expect(Number(order.finalAmount)).toBe(123456);
    expect((await h.db.problemRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe('BOOKED');
    expect((await h.db.offer.findUniqueOrThrow({ where: { id: offerId } })).status).toBe('ACCEPTED');
    expect(await h.db.orderStatusHistory.count({ where: { orderId: order.id, newStatus: 'BOOKED' } })).toBe(1);
    expect(await h.db.conversation.count({ where: { orderId: order.id } })).toBe(1);
    expect(await h.db.conversationParticipant.count({ where: { conversation: { orderId: order.id } } })).toBe(2);
    expect(await h.db.outboxEvent.count({ where: { eventName: 'order.booked', aggregateId: order.id } })).toBe(1);
    await h.db.offer.update({ where: { id: offerId }, data: { price: 1 } });
    expect(Number((await h.db.order.findUniqueOrThrow({ where: { id: order.id } })).finalAmount)).toBe(123456);
  });

  it('two customers-side accepts of DIFFERENT offers on one request: exactly one booking wins, the rest are rejected', async () => {
    const masters: TestMaster[] = [];
    for (let i = 0; i < 4; i += 1) masters.push(await createMaster(h, service.id));
    const requestId = await openRequest(h, customer, service.id);
    const offers = await Promise.all(masters.map((m) => h.post('/offers', m.token, { requestId, price: 1000 }).then((r) => r.data.id as string)));
    const results = await Promise.all(offers.map((id) => h.post(`/offers/${id}/accept`, customer.token, undefined, { idempotent: true })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
    expect(await h.db.booking.count({ where: { requestId } })).toBe(1);
    expect(await h.db.order.count({ where: { booking: { requestId } } })).toBe(1);
    expect(await h.db.offer.count({ where: { requestId, status: 'ACCEPTED' } })).toBe(1);
    expect(await h.db.offer.count({ where: { requestId, status: 'REJECTED' } })).toBe(3);
  });

  it('the same offer accepted concurrently with DIFFERENT keys still yields one order', async () => {
    const m = await createMaster(h, service.id);
    const requestId = await openRequest(h, customer, service.id);
    const offerId = (await h.post('/offers', m.token, { requestId, price: 1000 })).data.id;
    const results = await Promise.all(Array.from({ length: 6 }, () => h.post(`/offers/${offerId}/accept`, customer.token, undefined, { idempotent: true })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await h.db.order.count({ where: { booking: { requestId } } })).toBe(1);
  });

  it('idempotency: the same key replays the original response (same order), also under concurrency; keys are per-user', async () => {
    const m = await createMaster(h, service.id);
    const requestId = await openRequest(h, customer, service.id);
    const offerId = (await h.post('/offers', m.token, { requestId, price: 1000 })).data.id;
    const key = `idem-${randomUUID()}`;
    const send = () => h.api('POST', `/offers/${offerId}/accept`, { token: customer.token, headers: { 'idempotency-key': key } });
    const results = await Promise.all([send(), send(), send()]);
    const ok = results.filter((r) => r.status === 201);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    for (const r of results.filter((x) => x.status !== 201)) expect(r.body.code).toBe('IDEMPOTENCY_IN_PROGRESS');
    const later = await send();
    expect(later.status).toBe(201);
    expect(later.data.order.id).toBe(ok[0]!.data.order.id);
    expect(await h.db.order.count({ where: { booking: { requestId } } })).toBe(1);

    const foreign = await h.api('POST', `/offers/${offerId}/accept`, { token: stranger.token, headers: { 'idempotency-key': key } });
    expect(foreign.status).toBe(403);
  });

  it('an expired idempotency key is forgotten (24 h window is real)', async () => {
    const m = await createMaster(h, service.id);
    const requestId = await openRequest(h, customer, service.id);
    const offerId = (await h.post('/offers', m.token, { requestId, price: 1000 })).data.id;
    const key = `idem-${randomUUID()}`;
    await h.db.idempotencyKey.create({
      data: { userId: customer.id, method: 'POST', endpoint: `/api/v1/offers/${offerId}/accept`, key, requestHash: 'stale', expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await h.api('POST', `/offers/${offerId}/accept`, { token: customer.token, headers: { 'idempotency-key': key } });
    expect(res.status).toBe(201);
  });

  it('booking availability: a master cannot be double-booked; schedule windows and pauses are honoured', async () => {
    const m = await createMaster(h, service.id);
    const slot = inDays(3, 6);
    const r1 = await openRequest(h, customer, service.id);
    const r2 = await openRequest(h, customer, service.id);
    const r3 = await openRequest(h, customer, service.id);
    const o1 = (await h.post('/offers', m.token, { requestId: r1, price: 1, estimatedMinutes: 120, availableAt: slot })).data.id;
    const o2 = (await h.post('/offers', m.token, { requestId: r2, price: 1, estimatedMinutes: 60, availableAt: new Date(Date.parse(slot) + 30 * 60_000).toISOString() })).data.id;
    const o3 = (await h.post('/offers', m.token, { requestId: r3, price: 1, estimatedMinutes: 60, availableAt: new Date(Date.parse(slot) + 3 * 3_600_000).toISOString() })).data.id;

    expect((await h.post(`/offers/${o1}/accept`, customer.token, undefined, { idempotent: true })).status).toBe(201);
    const clash = await h.post(`/offers/${o2}/accept`, customer.token, undefined, { idempotent: true });
    expect(clash.status).toBe(409);
    expect(clash.body.code).toBe('MASTER_TIME_UNAVAILABLE');
    expect((await h.post(`/offers/${o3}/accept`, customer.token, undefined, { idempotent: true })).status).toBe(201);

    const scheduled = await createMaster(h, service.id);
    await h.db.masterAvailability.create({ data: { masterId: scheduled.masterId, dayOfWeek: 1, startTime: '09:00', endTime: '13:00' } });
    const nextMonday = new Date();
    nextMonday.setUTCDate(nextMonday.getUTCDate() + ((8 - nextMonday.getUTCDay()) % 7 || 7) + 7);
    const mondayAt = (utcHour: number) => { const d = new Date(nextMonday); d.setUTCHours(utcHour, 0, 0, 0); return d.toISOString(); };
    const rIn = await openRequest(h, customer, service.id);
    const rOut = await openRequest(h, customer, service.id);
    const rDay = await openRequest(h, customer, service.id);
    const inWindow = (await h.post('/offers', scheduled.token, { requestId: rIn, price: 1, estimatedMinutes: 60, availableAt: mondayAt(6) })).data.id;
    const afterHours = (await h.post('/offers', scheduled.token, { requestId: rOut, price: 1, estimatedMinutes: 60, availableAt: mondayAt(12) })).data.id;
    const tuesday = new Date(nextMonday); tuesday.setUTCDate(tuesday.getUTCDate() + 1); tuesday.setUTCHours(6, 0, 0, 0);
    const wrongDay = (await h.post('/offers', scheduled.token, { requestId: rDay, price: 1, estimatedMinutes: 60, availableAt: tuesday.toISOString() })).data.id;
    expect((await h.post(`/offers/${afterHours}/accept`, customer.token, undefined, { idempotent: true })).body.code).toBe('MASTER_TIME_UNAVAILABLE');
    expect((await h.post(`/offers/${wrongDay}/accept`, customer.token, undefined, { idempotent: true })).body.code).toBe('MASTER_TIME_UNAVAILABLE');
    expect((await h.post(`/offers/${inWindow}/accept`, customer.token, undefined, { idempotent: true })).status).toBe(201);

    const napper = await createMaster(h, service.id);
    const rp = await openRequest(h, customer, service.id);
    const op = (await h.post('/offers', napper.token, { requestId: rp, price: 1 })).data.id;
    await h.db.masterProfile.update({ where: { id: napper.masterId }, data: { isPaused: true } });
    expect((await h.post(`/offers/${op}/accept`, customer.token, undefined, { idempotent: true })).body.code).toBe('MASTER_TIME_UNAVAILABLE');
  });

  it('an expired offer cannot be accepted', async () => {
    const m = await createMaster(h, service.id);
    const requestId = await openRequest(h, customer, service.id);
    const offerId = (await h.post('/offers', m.token, { requestId, price: 10 })).data.id;
    await h.db.offer.update({ where: { id: offerId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await h.post(`/offers/${offerId}/accept`, customer.token, undefined, { idempotent: true });
    expect(res.status).toBe(409);
  });

  it('GET /bookings/:id is participant-only', async () => {
    const m = await createMaster(h, service.id);
    const requestId = await openRequest(h, customer, service.id);
    const offerId = (await h.post('/offers', m.token, { requestId, price: 10 })).data.id;
    const { booking } = (await h.post(`/offers/${offerId}/accept`, customer.token, undefined, { idempotent: true })).data;
    expect((await h.get(`/bookings/${booking.id}`, customer.token)).status).toBe(200);
    expect((await h.get(`/bookings/${booking.id}`, m.token)).status).toBe(200);
    expect((await h.get(`/bookings/${booking.id}`, stranger.token)).status).toBe(403);
    expect((await h.get(`/bookings/${MISSING_UUID}`, customer.token)).status).toBe(404);
  });
});

describe('Outbox → Redis/BullMQ → worker', () => {
  const emit = (eventName: string, payload: Record<string, unknown>) =>
    h.db.outboxEvent.create({ data: { eventName, aggregateType: 'Test', aggregateId: randomUUID(), payload: payload as any, status: 'PENDING' } });

  it('a PENDING event is picked up by the dispatcher, processed by the worker and marked PUBLISHED once', async () => {
    const event = await emit('some.unknown.event', {});
    const done = await waitFor(async () => {
      const e = await h.db.outboxEvent.findUnique({ where: { id: event.id } });
      return e?.status === 'PUBLISHED' ? e : null;
    }, { label: 'event published' });
    expect(done.attempts).toBe(1);
    expect(done.publishedAt).not.toBeNull();
  });

  it('events scheduled for the future are not dispatched early (availableAt)', async () => {
    const event = await h.db.outboxEvent.create({
      data: { eventName: 'some.unknown.event', aggregateType: 'Test', aggregateId: randomUUID(), payload: {}, status: 'PENDING', availableAt: new Date(Date.now() + 3_600_000) },
    });
    await new Promise((r) => setTimeout(r, 4_500));
    expect((await h.db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).status).toBe('PENDING');
  });

  it('at-least-once delivery is safe: re-running the handler for an already-handled event never duplicates the notification', async () => {
    const orderId = randomUUID();
    const event = await emit('payment.succeeded', { paymentId: randomUUID(), orderId, customerId: customer.id });
    await waitFor(async () => (await h.db.outboxEvent.findUnique({ where: { id: event.id } }))?.status === 'PUBLISHED', { label: 'published' });

    const processor = h.app.get(OutboxProcessor) as unknown as { process(job: { data: { eventId: string } }): Promise<void> };
    await processor.process({ data: { eventId: event.id } });
    await h.db.outboxEvent.update({ where: { id: event.id }, data: { status: 'PENDING' } });
    await Promise.all([processor.process({ data: { eventId: event.id } }), processor.process({ data: { eventId: event.id } })]);
    const notes = await h.db.notification.findMany({ where: { data: { path: ['outboxEventId'], equals: event.id } } });
    expect(notes).toHaveLength(1);
  });

  it('BullMQ de-duplicates a job by outbox event id (two dispatchers, one job)', async () => {
    const queue = h.app.get(QueueService);
    const id = randomUUID();
    await Promise.all([queue.enqueueOutboxEvent(id), queue.enqueueOutboxEvent(id), queue.enqueueOutboxEvent(id)]);
    const jobs = await queue.getQueue().getJobs(['waiting', 'active', 'delayed', 'completed', 'failed']);
    expect(jobs.filter((j) => j.id === id).length).toBe(1);
  });

  it('a transient failure is retried by BullMQ with backoff and succeeds; a permanent failure is dead-lettered as FAILED', async () => {
    const media = h.app.get(MediaProcessingService);
    const assetId = randomUUID();

    let calls = 0;
    const spy = vi.spyOn(media, 'process').mockImplementation(async () => {
      calls += 1;
      if (calls < 3) throw new Error('scanner temporarily unreachable');
    });
    const flaky = await emit('media.quarantined', { mediaAssetId: assetId });
    const ok = await waitFor(async () => {
      const e = await h.db.outboxEvent.findUnique({ where: { id: flaky.id } });
      return e?.status === 'PUBLISHED' ? e : null;
    }, { label: 'retried event published', timeoutMs: 30_000 });
    expect(calls).toBe(3);
    expect(ok.status).toBe('PUBLISHED');

    spy.mockReset();
    spy.mockRejectedValue(new Error('scanner is down for good'));
    const doomed = await emit('media.quarantined', { mediaAssetId: assetId });
    const dead = await waitFor(async () => {
      const e = await h.db.outboxEvent.findUnique({ where: { id: doomed.id } });
      return e?.status === 'FAILED' ? e : null;
    }, { label: 'dead-lettered', timeoutMs: 40_000 });
    expect(dead.lastError).toContain('scanner is down for good');
    expect(dead.attempts).toBe(5);
    spy.mockRestore();
  });

  it('domain writes and their events commit together: a rolled-back submit leaves no event behind', async () => {
    const draftId = (await h.post('/problem-requests', customer.token, { title: 'Atomic', description: 'atomicity check request' })).data.id;
    const before = await h.db.outboxEvent.count({ where: { aggregateId: draftId } });
    await h.post(`/problem-requests/${draftId}/cancel`, customer.token, { reason: 'x' });
    expect((await h.post(`/problem-requests/${draftId}/submit`, customer.token)).status).toBe(409);
    expect(await h.db.outboxEvent.count({ where: { aggregateId: draftId } })).toBe(before);
  });
});
