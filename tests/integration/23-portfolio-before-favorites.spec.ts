import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createAdmin, createMaster, createUser, firstService, type Harness, MISSING_UUID, type TestUser, uploadImage } from '../helpers/harness';

let h: Harness;
let service: { id: string; categoryId: string };
let admin: TestUser;
let customer: TestUser;

beforeAll(async () => {
  h = await bootHarness();
  service = await firstService(h);
  admin = await createAdmin(h);
  customer = await createUser(h, ['CUSTOMER']);
});
afterAll(async () => {
  await h.close();
});

describe('Portfolio: oldin / keyin', () => {
  it('a before-image is optional, validated like the main one and becomes public only after approval', async () => {
    const m = await createMaster(h, service.id);
    const rival = await createMaster(h, service.id);
    const after = await uploadImage(h, m.token, 'MASTER_PORTFOLIO', 'MasterProfile', m.masterId, 80);
    const before = await uploadImage(h, m.token, 'MASTER_PORTFOLIO', 'MasterProfile', m.masterId, 81);
    const foreign = await uploadImage(h, rival.token, 'MASTER_PORTFOLIO', 'MasterProfile', rival.masterId, 82);

    expect((await h.post('/masters/me/portfolio', m.token, { mediaAssetId: after, beforeMediaAssetId: after })).status).toBe(400);
    expect((await h.post('/masters/me/portfolio', m.token, { mediaAssetId: after, beforeMediaAssetId: foreign })).status).toBe(403);
    expect((await h.post('/masters/me/portfolio', m.token, { mediaAssetId: after, beforeMediaAssetId: MISSING_UUID })).status).toBe(403);
    expect((await h.post('/masters/me/portfolio', m.token, { mediaAssetId: after, beforeMediaAssetId: 'nope' })).status).toBe(400);

    const item = await h.post('/masters/me/portfolio', m.token, { mediaAssetId: after, beforeMediaAssetId: before, title: 'Kran' });
    expect(item.status).toBe(201);
    expect(item.data.beforeMediaAssetId).toBe(before);

    expect((await h.get(`/media/${before}/thumbnail`, customer.token)).status).toBe(403);
    expect((await h.get(`/masters/${m.masterId}`, customer.token)).data.portfolio).toEqual([]);

    expect((await h.post(`/admin/portfolio/${item.data.id}/review`, admin.token, { decision: 'APPROVE' })).status).toBe(201);
    expect((await h.get(`/media/${before}/thumbnail`, customer.token)).status).toBe(200);
    const page = await h.get(`/masters/${m.masterId}`, customer.token);
    expect(page.data.portfolio).toHaveLength(1);
    expect(page.data.portfolio[0]).toMatchObject({ mediaAssetId: after, beforeMediaAssetId: before });

    expect((await h.del(`/masters/me/portfolio/${item.data.id}`, m.token)).status).toBe(200);
    expect(await h.db.mediaAsset.count({ where: { id: { in: [after, before] } } })).toBe(0);
  });
});

describe('Public availability', () => {
  it('shows only open windows that are currently effective', async () => {
    const m = await createMaster(h, service.id);
    await h.post('/masters/me/availability', m.token, { dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isAvailable: true });
    await h.post('/masters/me/availability', m.token, { dayOfWeek: 2, startTime: '09:00', endTime: '12:00', isAvailable: false });
    const res = await h.get(`/masters/${m.masterId}/availability`, customer.token);
    expect(res.status).toBe(200);
    expect(res.data).toEqual([{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }]);
    expect((await h.get(`/masters/${MISSING_UUID}/availability`, customer.token)).status).toBe(404);
  });
});

describe('Saved masters', () => {
  it('customers can save, list and remove masters; unknown masters 404', async () => {
    const m = await createMaster(h, service.id);
    const other = await createMaster(h, service.id);
    expect((await h.api('PUT', `/customers/me/favorites/${MISSING_UUID}`, { token: customer.token })).status).toBe(404);
    expect((await h.api('PUT', '/customers/me/favorites/nope', { token: customer.token })).status).toBe(400);

    expect((await h.api('PUT', `/customers/me/favorites/${m.masterId}`, { token: customer.token })).data).toEqual({ saved: true });
    expect((await h.api('PUT', `/customers/me/favorites/${m.masterId}`, { token: customer.token })).status).toBeLessThan(300); // idempotent
    await h.api('PUT', `/customers/me/favorites/${other.masterId}`, { token: customer.token });
    const list = await h.get('/customers/me/favorites', customer.token);
    expect(list.data.map((x: any) => x.id)).toEqual([other.masterId, m.masterId]);

    const stranger = await createUser(h, ['CUSTOMER']);
    expect((await h.get('/customers/me/favorites', stranger.token)).data).toEqual([]);

    expect((await h.del(`/customers/me/favorites/${m.masterId}`, customer.token)).data).toEqual({ saved: false });
    expect((await h.get('/customers/me/favorites', customer.token)).data.map((x: any) => x.id)).toEqual([other.masterId]);
  });
});

describe('Payment method preference', () => {
  it('accepts only known providers', async () => {
    expect((await h.patch('/customers/me/preferences', customer.token, { paymentMethod: 'BITCOIN' })).status).toBe(400);
    const ok = await h.patch('/customers/me/preferences', customer.token, { paymentMethod: 'CLICK' });
    expect(ok.status).toBe(200);
    expect((await h.get('/customers/me/preferences', customer.token)).data.paymentMethod).toBe('CLICK');
  });
});
