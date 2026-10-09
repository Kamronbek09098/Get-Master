import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MatchingService } from '../../src/modules/matching/matching.service';
import { bootHarness, createMaster, freshService, createUser, firstService, type Harness, MISSING_UUID, type TestMaster, type TestUser, waitFor, soon } from '../helpers/harness';

let h: Harness;
let service: { id: string; categoryId: string };
let otherService: { id: string };
let customer: TestUser;
let stranger: TestUser;

beforeAll(async () => {
  h = await bootHarness();
  const services = await h.db.service.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, take: 2 });
  service = services[0]!;
  otherService = services[1]!;
  customer = await createUser(h, ['CUSTOMER']);
  stranger = await createUser(h, ['CUSTOMER']);
});
afterAll(async () => {
  await h.close();
});

const draft = (over: Record<string, unknown> = {}) => ({
  preferredStartAt: new Date(Date.now() + 86_400_000).toISOString(),
  title: `Leaky tap ${Math.random().toString(36).slice(2, 8)}`,
  description: 'Water drips from the kitchen tap all night long.',
  latitude: 41.311,
  longitude: 69.279,
  ...over,
});

describe('K05 — request lifecycle', () => {
  it('validates input and is CUSTOMER-only', async () => {
    expect((await h.post('/problem-requests', customer.token, { preferredStartAt: soon(), description: 'x' })).status).toBe(400);
    // Manzil majburiy: saqlangan manzil yoki koordinatalarsiz so'rov yaratilmaydi.
    const noAddress = await h.post('/problem-requests', customer.token, { preferredStartAt: soon(), title: 'No address', description: 'Request without any address or coordinates.' });
    expect(noAddress.status).toBe(400);
    expect((await h.post('/problem-requests', customer.token, draft({ latitude: 200 }))).status).toBe(400);
    expect((await h.post('/problem-requests', customer.token, draft({ status: 'BOOKED' }))).status).toBe(400);
    expect((await h.post('/problem-requests', customer.token, draft({ serviceId: 'nope' }))).status).toBe(400);
    const master = await createMaster(h, service.id);
    expect((await h.post('/problem-requests', undefined, draft())).status).toBe(401);
    const pureMaster = await createUser(h, ['MASTER']);
    expect((await h.post('/problem-requests', pureMaster.token, draft())).status).toBe(403);
    expect(master.id).toBeTruthy();
  });

  it('enforces ownership on every operation (BOLA)', async () => {
    const created = await h.post('/problem-requests', customer.token, draft());
    const id = created.data.id;
    expect((await h.get(`/problem-requests/${id}`, customer.token)).status).toBe(200);
    for (const [method, path, body] of [
      ['GET', `/problem-requests/${id}`, undefined],
      ['PATCH', `/problem-requests/${id}`, { title: 'hijack' }],
      ['POST', `/problem-requests/${id}/submit`, undefined],
      ['POST', `/problem-requests/${id}/cancel`, { reason: 'because' }],
      ['GET', `/problem-requests/${id}/offers`, undefined],
      ['GET', `/problem-requests/${id}/classification`, undefined],
      ['GET', `/problem-requests/${id}/matching`, undefined],
      ['POST', `/problem-requests/${id}/classification`, { serviceId: service.id }],
    ] as const) {
      const res = await h.api(method, path, { token: stranger.token, body });
      expect(res.status, `${method} ${path}`).toBe(403);
    }
    expect((await h.db.problemRequest.findUniqueOrThrow({ where: { id } })).title).toBe(created.data.title);
    expect((await h.get(`/problem-requests/${MISSING_UUID}`, customer.token)).status).toBe(404);
    expect((await h.get('/problem-requests?limit=100', stranger.token)).data.items).toEqual([]);
  });

  it('DRAFT is editable, then locked; submit is one-way and queues classification atomically', async () => {
    const id = (await h.post('/problem-requests', customer.token, draft())).data.id;
    expect((await h.patch(`/problem-requests/${id}`, customer.token, { title: 'Edited title' })).data.title).toBe('Edited title');

    const submitted = await h.post(`/problem-requests/${id}/submit`, customer.token);
    expect(submitted.status).toBe(201);
    expect(submitted.data.status).toBe('SUBMITTED');
    expect(submitted.data.expiresAt).toBeTruthy();
    expect(await h.db.outboxEvent.count({ where: { eventName: 'classification.requested', aggregateId: id } })).toBe(1);

    expect((await h.patch(`/problem-requests/${id}`, customer.token, { title: 'late edit' })).status).toBe(403);
    expect((await h.post(`/problem-requests/${id}/submit`, customer.token)).status).toBe(409);
    expect(await h.db.outboxEvent.count({ where: { eventName: 'classification.requested', aggregateId: id } })).toBe(1);
  });

  it('a concurrent double-submit queues exactly one classification', async () => {
    const id = (await h.post('/problem-requests', customer.token, draft())).data.id;
    const results = await Promise.all(Array.from({ length: 5 }, () => h.post(`/problem-requests/${id}/submit`, customer.token)));
    expect(results.filter((r) => r.status === 201).length).toBeGreaterThanOrEqual(1);
    expect(await h.db.outboxEvent.count({ where: { eventName: 'classification.requested', aggregateId: id } })).toBe(results.filter((r) => r.status === 201).length);
    expect(results.filter((r) => r.status === 201).length).toBe(1);
  });

  it('cancel works from DRAFT/SUBMITTED, requires a reason, and is terminal', async () => {
    const id = (await h.post('/problem-requests', customer.token, draft())).data.id;
    expect((await h.post(`/problem-requests/${id}/cancel`, customer.token, {})).status).toBe(400);
    const cancelled = await h.post(`/problem-requests/${id}/cancel`, customer.token, { reason: 'Fixed it myself' });
    expect(cancelled.data.status).toBe('CANCELLED');
    expect((await h.post(`/problem-requests/${id}/cancel`, customer.token, { reason: 'again' })).status).toBe(409);
    expect((await h.post(`/problem-requests/${id}/submit`, customer.token)).status).toBe(409);

    const booked = (await h.post('/problem-requests', customer.token, draft())).data.id;
    await h.db.problemRequest.update({ where: { id: booked }, data: { status: 'BOOKED' } });
    expect((await h.post(`/problem-requests/${booked}/cancel`, customer.token, { reason: 'too late' })).status).toBe(409);
  });

  it('a double-clicked create returns the same draft instead of stacking duplicates', async () => {
    const payload = draft({ title: 'Double click' });
    const [a, b] = [await h.post('/problem-requests', customer.token, payload), await h.post('/problem-requests', customer.token, payload)];
    expect(b.data.id).toBe(a.data.id);
  });

  it('lists with cursor pagination, sort direction and status filter', async () => {
    const lister = await createUser(h, ['CUSTOMER']);
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      ids.push((await h.post('/problem-requests', lister.token, draft({ title: `List ${i}` }))).data.id);
      await new Promise((r) => setTimeout(r, 15));
    }
    await h.post(`/problem-requests/${ids[0]}/cancel`, lister.token, { reason: 'x' });

    const desc = await h.get('/problem-requests?limit=50', lister.token);
    expect(desc.data.items.map((r: any) => r.id)).toEqual([...ids].reverse());
    const asc = await h.get('/problem-requests?sort=asc&limit=50', lister.token);
    expect(asc.data.items.map((r: any) => r.id)).toEqual(ids);

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: any = await h.get(`/problem-requests?limit=2${cursor ? `&cursor=${cursor}` : ''}`, lister.token);
      expect(page.data.items.length).toBeLessThanOrEqual(2);
      seen.push(...page.data.items.map((r: any) => r.id));
      cursor = page.data.nextCursor;
    } while (cursor);
    expect(seen).toEqual([...ids].reverse());

    expect((await h.get('/problem-requests?status=CANCELLED', lister.token)).data.items).toHaveLength(1);
    expect((await h.get('/problem-requests?status=DRAFT', lister.token)).data.items).toHaveLength(4);
    for (const bad of ['sort=sideways', 'status=NOPE', 'limit=0', 'limit=101', 'cursor=abc']) {
      expect((await h.get(`/problem-requests?${bad}`, lister.token)).status, bad).toBe(400);
    }
  });
});

describe('K06 — classification fallback (no AI provider configured)', () => {
  it('a submitted request with no service is never blocked: fallback record, manual selection then triggers matching', async () => {
    const master = await createMaster(h, service.id);
    const id = (await h.post('/problem-requests', customer.token, draft())).data.id;
    await h.post(`/problem-requests/${id}/submit`, customer.token);

    const fallback = await waitFor(async () => h.db.aIClassification.findFirst({ where: { requestId: id } }), { label: 'classification record' });
    expect(fallback.confidence).toBeNull();
    expect(fallback.serviceId).toBeNull();
    const request = await h.db.problemRequest.findUniqueOrThrow({ where: { id } });
    expect(request.status).toBe('SUBMITTED');
    expect(request.serviceId).toBeNull();
    expect(await h.db.matchingRun.count({ where: { requestId: id } })).toBe(0);

    const latest = await h.get(`/problem-requests/${id}/classification`, customer.token);
    expect(latest.data.serviceId).toBeNull();

    expect((await h.post(`/problem-requests/${id}/classification`, customer.token, { serviceId: MISSING_UUID })).status).toBe(404);
    expect((await h.post(`/problem-requests/${id}/classification`, customer.token, { serviceId: 'nope' })).status).toBe(400);
    const chosen = await h.post(`/problem-requests/${id}/classification`, customer.token, { serviceId: service.id });
    expect(chosen.status).toBe(201);
    expect(Number(chosen.data.confidence)).toBe(1);

    const run = await waitFor(async () => {
      const r = await h.db.matchingRun.findFirst({ where: { requestId: id, status: 'COMPLETED' } });
      return r;
    }, { label: 'matching run after manual selection' });
    const results = await h.db.matchingResult.findMany({ where: { runId: run.id } });
    expect(results.map((r) => r.masterId)).toContain(master.masterId);
    const derived = await h.db.problemRequest.findUniqueOrThrow({ where: { id } });
    expect(derived.serviceId).toBe(service.id);
    expect(derived.categoryId).toBe(service.categoryId);
  });

  it('a request with a service picked at creation goes straight through classification → matching', async () => {
    const id = (await h.post('/problem-requests', customer.token, draft({ serviceId: service.id }))).data.id;
    await h.post(`/problem-requests/${id}/submit`, customer.token);
    await waitFor(async () => h.db.matchingRun.findFirst({ where: { requestId: id, status: 'COMPLETED' } }), { label: 'matching' });
    expect((await h.db.problemRequest.findUniqueOrThrow({ where: { id } })).status).toBe('MATCHING');
  });
});

describe('K07 — matching engine', () => {
  let request: string;
  let strong: TestMaster;
  let weak: TestMaster;
  const excluded: Record<string, TestMaster> = {};

  let svc: { id: string };
  let otherSvc: { id: string };

  beforeAll(async () => {
    svc = await freshService(h);
    otherSvc = await freshService(h);
    const near = { latitude: 41.3111, longitude: 69.2797 };
    strong = await createMaster(h, svc.id, { ...near, workRadiusKm: 30, firstName: 'Strong' });
    weak = await createMaster(h, svc.id, { ...near, workRadiusKm: 30, firstName: 'Weak' });
    await h.db.masterProfile.update({ where: { id: strong.masterId }, data: { ratingAvg: 4.9, ratingCount: 40 } });
    await h.db.masterProfile.update({ where: { id: weak.masterId }, data: { ratingAvg: 3.1, ratingCount: 5 } });

    excluded.wrongService = await createMaster(h, otherSvc.id, { ...near, workRadiusKm: 30 });
    excluded.unverified = await createMaster(h, svc.id, { ...near, workRadiusKm: 30 });
    await h.db.masterProfile.update({ where: { id: excluded.unverified.masterId }, data: { verification: 'PENDING' } });
    excluded.paused = await createMaster(h, svc.id, { ...near, workRadiusKm: 30 });
    await h.db.masterProfile.update({ where: { id: excluded.paused.masterId }, data: { isPaused: true } });
    excluded.inactive = await createMaster(h, svc.id, { ...near, workRadiusKm: 30 });
    await h.db.masterProfile.update({ where: { id: excluded.inactive.masterId }, data: { status: 'INACTIVE' } });
    excluded.farAway = await createMaster(h, svc.id, { latitude: 39.65, longitude: 66.97, workRadiusKm: 20 });
    excluded.serviceOff = await createMaster(h, svc.id, { ...near, workRadiusKm: 30 });
    await h.db.masterService.updateMany({ where: { masterId: excluded.serviceOff.masterId }, data: { isActive: false } });

    request = (await h.post('/problem-requests', customer.token, draft({ serviceId: svc.id, latitude: 41.32, longitude: 69.28 }))).data.id;
    await h.post(`/problem-requests/${request}/submit`, customer.token);
  });

  it('hard-filters to verified, active, unpaused masters who offer the service inside their radius', async () => {
    const run = await waitFor(async () => h.db.matchingRun.findFirst({ where: { requestId: request, status: 'COMPLETED' } }), { label: 'matching run' });
    const ids = (await h.db.matchingResult.findMany({ where: { runId: run.id } })).map((r) => r.masterId);
    expect(ids).toEqual(expect.arrayContaining([strong.masterId, weak.masterId]));
    for (const [name, m] of Object.entries(excluded)) expect(ids, name).not.toContain(m.masterId);
  });

  it('ranks deterministically by the §6 score (better-rated master first) and exposes the reasons', async () => {
    const view = await h.get(`/problem-requests/${request}/matching`, customer.token);
    expect(view.status).toBe(200);
    const mine = view.data.results.filter((r: any) => [strong.masterId, weak.masterId].includes(r.masterId));
    expect(mine[0].masterId).toBe(strong.masterId);
    expect(Number(mine[0].score)).toBeGreaterThan(Number(mine[1].score));
    expect(mine[0].reason).toMatchObject({ relevance: expect.any(Number), distanceRatio: expect.any(Number), rating: expect.any(Number) });
    expect(Number(mine[0].distanceKm)).toBeLessThan(5);
  });

  it('wave 1 notifies the candidates (once each) and the request advances to MATCHING', async () => {
    const note = await waitFor(async () => h.db.notification.findFirst({ where: { userId: strong.id, template: 'matching.wave' } }), { label: 'wave notification' });
    expect((note.data as any).requestId).toBe(request);
    expect(await h.db.notification.count({ where: { userId: strong.id, template: 'matching.wave' } })).toBe(1);
    for (const m of Object.values(excluded)) expect(await h.db.notification.count({ where: { userId: m.id, template: 'matching.wave' } })).toBe(0);
    expect((await h.db.problemRequest.findUniqueOrThrow({ where: { id: request } })).status).toBe('MATCHING');
    const results = await h.db.matchingResult.findMany({ where: { masterId: { in: [strong.masterId, weak.masterId] }, run: { requestId: request } } });
    expect(results.every((r) => r.status === 'NOTIFIED')).toBe(true);
  });

  it('schedules the next wave through the outbox with a future availableAt (~5 min)', async () => {
    const wave2 = await h.db.outboxEvent.findFirst({ where: { eventName: 'matching.wave', aggregateId: request } });
    expect(wave2).not.toBeNull();
    const delay = wave2!.availableAt.getTime() - Date.now();
    expect(delay).toBeGreaterThan(4 * 60_000);
    expect(delay).toBeLessThanOrEqual(5 * 60_000 + 5_000);
    expect(wave2!.status).toBe('PENDING');
  });

  it('a duplicated/concurrent matching trigger starts exactly one run', async () => {
    const id = (await h.post('/problem-requests', customer.token, draft({ serviceId: service.id }))).data.id;
    await h.db.problemRequest.update({ where: { id }, data: { status: 'SUBMITTED' } });
    const matching = h.app.get(MatchingService);
    await Promise.all(Array.from({ length: 6 }, () => matching.runMatching(id)));
    expect(await h.db.matchingRun.count({ where: { requestId: id } })).toBe(1);
  });

  it('waves are capped at 5 masters and later waves pick up the remaining candidates without re-notifying', async () => {
    const svc = (await h.db.service.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, skip: 2, take: 1 }))[0]!;
    const masters: TestMaster[] = [];
    for (let i = 0; i < 7; i += 1) masters.push(await createMaster(h, svc.id, { firstName: `W${i}` }));
    const id = (await h.post('/problem-requests', customer.token, draft({ serviceId: svc.id }))).data.id;
    await h.post(`/problem-requests/${id}/submit`, customer.token);

    const run = await waitFor(async () => h.db.matchingRun.findFirst({ where: { requestId: id, status: 'COMPLETED' } }), { label: 'matching run' });
    await waitFor(async () => (await h.db.matchingResult.count({ where: { runId: run.id, status: 'NOTIFIED' } })) === 5, { label: 'wave 1' });
    expect(await h.db.matchingResult.count({ where: { runId: run.id, status: 'CANDIDATE' } })).toBe(2);

    await h.db.outboxEvent.updateMany({ where: { eventName: 'matching.wave', aggregateId: id, status: 'PENDING' }, data: { availableAt: new Date() } });
    await waitFor(async () => (await h.db.matchingResult.count({ where: { runId: run.id, status: 'NOTIFIED' } })) === 7, { label: 'wave 2', timeoutMs: 40_000 });
    for (const m of masters) expect(await h.db.notification.count({ where: { userId: m.id, template: 'matching.wave' } }), m.id).toBe(1);
  });

  it('stops notifying once the request is no longer open for offers', async () => {
    const svc = (await h.db.service.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, skip: 3, take: 1 }))[0]!;
    for (let i = 0; i < 6; i += 1) await createMaster(h, svc.id);
    const id = (await h.post('/problem-requests', customer.token, draft({ serviceId: svc.id }))).data.id;
    await h.post(`/problem-requests/${id}/submit`, customer.token);
    const run = await waitFor(async () => h.db.matchingRun.findFirst({ where: { requestId: id, status: 'COMPLETED' } }), { label: 'matching run' });
    await waitFor(async () => (await h.db.matchingResult.count({ where: { runId: run.id, status: 'NOTIFIED' } })) === 5, { label: 'wave 1' });
    await h.post(`/problem-requests/${id}/cancel`, customer.token, { reason: 'changed my mind' });
    await h.db.outboxEvent.updateMany({ where: { eventName: 'matching.wave', aggregateId: id, status: 'PENDING' }, data: { availableAt: new Date() } });
    await waitFor(async () => (await h.db.outboxEvent.count({ where: { eventName: 'matching.wave', aggregateId: id, status: 'PUBLISHED' } })) >= 1, { label: 'wave 2 processed' });
    expect(await h.db.matchingResult.count({ where: { runId: run.id, status: 'NOTIFIED' } })).toBe(5);
    expect(await h.db.matchingResult.count({ where: { runId: run.id, status: 'CANDIDATE' } })).toBe(1);
  });

  it('a master with no history is scored neutrally, not penalised against one with a record', async () => {
    const svc = (await h.db.service.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, skip: 4, take: 1 }))[0]!;
    const veteran = await createMaster(h, svc.id);
    const rookie = await createMaster(h, svc.id);
    await h.db.masterProfile.update({ where: { id: veteran.masterId }, data: { completionRate: 100, responseRate: 100 } });
    await h.db.masterProfile.update({ where: { id: rookie.masterId }, data: { completionRate: 0, responseRate: 0 } });
    const id = (await h.post('/problem-requests', customer.token, draft({ serviceId: svc.id }))).data.id;
    await h.post(`/problem-requests/${id}/submit`, customer.token);
    const run = await waitFor(async () => h.db.matchingRun.findFirst({ where: { requestId: id, status: 'COMPLETED' } }), { label: 'matching run' });
    const rows = await h.db.matchingResult.findMany({ where: { runId: run.id } });
    const rookieRow = rows.find((r) => r.masterId === rookie.masterId)!;
    expect((rookieRow.reason as any).completion).toBe(0.5);
    expect((rookieRow.reason as any).response).toBe(0.5);
    const vetRow = rows.find((r) => r.masterId === veteran.masterId)!;
    expect((vetRow.reason as any).completion).toBe(0.5);
  });
});
