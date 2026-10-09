import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MasterStatsService } from '../../src/modules/master/master-stats.service';
import { bookOrder, bootHarness, createMaster, createUser, firstService, type Harness, openRequest, runWork, type TestMaster, type TestUser, waitFor, soon } from '../helpers/harness';

let h: Harness;
let service: { id: string };
let customer: TestUser;
let master: TestMaster;

beforeAll(async () => {
  h = await bootHarness();
  service = await firstService(h);
  customer = await createUser(h, ['CUSTOMER']);
  master = await createMaster(h, service.id);
});
afterAll(async () => {
  await h.close();
});

const stats = async () => {
  const m = await h.db.masterProfile.findUniqueOrThrow({ where: { id: master.masterId } });
  return { completed: m.completedOrders, completion: Number(m.completionRate), cancellation: Number(m.cancellationRate), response: Number(m.responseRate) };
};

describe('master statistics are derived from the real order/offer lifecycle', () => {
  it('a brand-new master starts at zero', async () => {
    expect(await stats()).toEqual({ completed: 0, completion: 0, cancellation: 0, response: 0 });
  });

  it('completion, cancellation and response rates follow completed / cancelled / expired orders and answered matches', async () => {
    for (let i = 0; i < 2; i += 1) {
      const order = await bookOrder(h, customer, master, service.id);
      await runWork(h, order, customer, master, true);
    }
    expect(await stats()).toMatchObject({ completed: 2, completion: 100, cancellation: 0 });

    const byMaster = await bookOrder(h, customer, master, service.id);
    expect((await h.post(`/orders/${byMaster.orderId}/cancel`, master.token, { reason: 'Emergency' })).status).toBe(201);
    const byCustomer = await bookOrder(h, customer, master, service.id);
    expect((await h.post(`/orders/${byCustomer.orderId}/cancel`, customer.token, { reason: 'Changed my mind' })).status).toBe(201);
    const expired = await bookOrder(h, customer, master, service.id);
    await h.db.order.update({ where: { id: expired.orderId }, data: { status: 'EXPIRED' } });
    await h.app.get(MasterStatsService).recompute(master.masterId);

    expect(await stats()).toMatchObject({ completed: 2, completion: 50, cancellation: 20 });
  });

  it('response rate = matched requests answered ÷ requests notified', async () => {
    const svc = await createMaster(h, service.id);
    const requests: string[] = [];
    for (let i = 0; i < 4; i += 1) requests.push(await openRequest(h, customer, service.id));
    const run = await h.db.matchingRun.create({ data: { requestId: requests[0]!, status: 'COMPLETED' } });
    for (const [i, requestId] of requests.entries()) {
      const r = i === 0 ? run : await h.db.matchingRun.create({ data: { requestId, status: 'COMPLETED' } });
      await h.db.matchingResult.create({ data: { runId: r.id, masterId: svc.masterId, status: 'NOTIFIED', score: 1 } });
    }
    const stat = () => h.db.masterProfile.findUniqueOrThrow({ where: { id: svc.masterId } }).then((m) => Number(m.responseRate));
    await h.app.get(MasterStatsService).recompute(svc.masterId);
    expect(await stat()).toBe(0);
    expect((await h.post('/offers', svc.token, { requestId: requests[0], price: 1000 })).status).toBe(201);
    expect(await stat()).toBe(25);
    expect((await h.post('/offers', svc.token, { requestId: requests[1], price: 1000 })).status).toBe(201);
    expect(await stat()).toBe(50);
    await h.db.matchingResult.updateMany({ where: { masterId: svc.masterId, run: { requestId: requests[2] } }, data: { status: 'DECLINED' } });
    await h.app.get(MasterStatsService).recompute(svc.masterId);
    expect(await stat()).toBe(75);
  });

  it('is idempotent and concurrency-safe: replays and parallel recomputations never drift or double-count', async () => {
    const before = await stats();
    const svc = h.app.get(MasterStatsService);
    await Promise.all(Array.from({ length: 10 }, () => svc.recompute(master.masterId)));
    await svc.recompute(master.masterId);
    expect(await stats()).toEqual(before);

    const order = await bookOrder(h, customer, master, service.id);
    expect((await h.post(`/orders/${order.orderId}/cancel`, master.token, { reason: 'x' })).status).toBe(201);
    const afterOne = await stats();
    const replays = await Promise.all(Array.from({ length: 4 }, () => h.post(`/orders/${order.orderId}/cancel`, master.token, { reason: 'x' })));
    expect(replays.every((r) => r.status === 409)).toBe(true);
    expect(await stats()).toEqual(afterOne);
  });

  it('parallel terminal transitions on different orders all count exactly once', async () => {
    const fresh = await createMaster(h, service.id);
    const orders = await Promise.all(Array.from({ length: 5 }, () => bookOrder(h, customer, fresh, service.id)));
    await Promise.all(orders.map((o) => h.post(`/orders/${o.orderId}/cancel`, fresh.token, { reason: 'burst' })));
    const m = await h.db.masterProfile.findUniqueOrThrow({ where: { id: fresh.masterId } });
    expect(Number(m.cancellationRate)).toBe(100);
    expect(Number(m.completionRate)).toBe(0);
    expect(m.completedOrders).toBe(0);
  });

  it('matching reads these figures: a proven master scores 1.0 on completion, a master with no record a neutral 0.5', async () => {
    const svc = (await h.db.service.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, skip: 5, take: 1 }))[0]!;
    const proven = await createMaster(h, svc.id);
    const rookie = await createMaster(h, svc.id);
    const done = await bookOrder(h, customer, proven, svc.id);
    await runWork(h, done, customer, proven, true);
    const id = (await h.post('/problem-requests', customer.token, { preferredStartAt: soon(), title: 'Stats matching', description: 'Matching must read real statistics.', serviceId: svc.id, latitude: 41.311, longitude: 69.279 })).data.id;
    await h.post(`/problem-requests/${id}/submit`, customer.token);
    const run = await waitFor(async () => h.db.matchingRun.findFirst({ where: { requestId: id, status: 'COMPLETED' } }), { label: 'matching' });
    const rows = await h.db.matchingResult.findMany({ where: { runId: run.id } });
    const provenReason = rows.find((r) => r.masterId === proven.masterId)!.reason as any;
    const rookieReason = rows.find((r) => r.masterId === rookie.masterId)!.reason as any;
    expect(provenReason.completion).toBe(1);
    expect(provenReason.cancellationPenalty).toBe(0);
    expect(rookieReason.completion).toBe(0.5);
    expect(Number(rows.find((r) => r.masterId === proven.masterId)!.score)).toBeGreaterThan(Number(rows.find((r) => r.masterId === rookie.masterId)!.score));
  });
});
