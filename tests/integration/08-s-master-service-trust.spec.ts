import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MasterService } from '../../src/modules/master/master.service';
import { TrustService } from '../../src/modules/trust/trust.service';
import { bootHarness, createAdmin, createMaster, createUser, firstService, type Harness, MISSING_UUID, type TestUser, uploadImage, waitFor } from '../helpers/harness';

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

async function aspirant() {
  return createUser(h, ['CUSTOMER']);
}

describe('S01 — master profile', () => {
  it('onboarding grants the MASTER role atomically and takes effect immediately (no re-login)', async () => {
    const user = await aspirant();
    expect((await h.get('/masters/me', user.token)).status).toBe(403);
    const created = await h.post('/masters/me', user.token, { profession: 'Plumber', bio: 'Ten years', experienceYears: 10, workRadiusKm: 15, latitude: 41.3, longitude: 69.2 });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({ status: 'INACTIVE', verification: 'PENDING', userId: user.id });
    expect(await h.db.userRole.count({ where: { userId: user.id, role: 'MASTER' } })).toBe(1);
    expect((await h.get('/masters/me', user.token)).status).toBe(200);
    expect((await h.post('/masters/me', user.token, { profession: 'Again' })).status).toBe(409);
  });

  it('concurrent onboarding creates exactly one profile', async () => {
    const user = await aspirant();
    const results = await Promise.all(Array.from({ length: 5 }, () => h.post('/masters/me', user.token, { profession: 'Racer' })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await h.db.masterProfile.count({ where: { userId: user.id } })).toBe(1);
  });

  it('validates input and refuses to let clients set protected fields', async () => {
    const user = await aspirant();
    for (const bad of [{}, { profession: '' }, { profession: 'x', ratingAvg: 5 }, { profession: 'x', verification: 'VERIFIED' }, { profession: 'x', status: 'ACTIVE' }, { profession: 'x', latitude: 999 }, { profession: 'x', workRadiusKm: 0 }, { profession: 'x', experienceYears: -1 }, { profession: 'x', serviceAreas: Array(21).fill('a') }]) {
      expect((await h.post('/masters/me', user.token, bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect(await h.db.masterProfile.count({ where: { userId: user.id } })).toBe(0);
    expect((await h.post('/masters/me', undefined, { profession: 'x' })).status).toBe(401);
    const suspended = await aspirant();
    await h.db.user.update({ where: { id: suspended.id }, data: { status: 'SUSPENDED' } });
    expect((await h.post('/masters/me', suspended.token, { profession: 'x' })).status).toBe(401);
  });

  it('a master edits only their own profile; verification/rating are read-only', async () => {
    const m = await createMaster(h, service.id);
    const other = await createMaster(h, service.id);
    const updated = await h.patch('/masters/me', m.token, { bio: 'New bio', workRadiusKm: 25 });
    expect(updated.data.bio).toBe('New bio');
    expect((await h.patch('/masters/me', m.token, { verification: 'VERIFIED', completedOrders: 999 })).status).toBe(400);
    expect((await h.db.masterProfile.findUniqueOrThrow({ where: { id: other.masterId } })).bio).toBeNull();
  });

  it('status: ACTIVE requires verification + an active service; moderation states cannot be self-cleared', async () => {
    const user = await aspirant();
    await h.post('/masters/me', user.token, { profession: 'Electrician' });
    const activate = () => h.patch('/masters/me/status', user.token, { status: 'ACTIVE' });
    const unverified = await activate();
    expect(unverified.status).toBe(409);
    const profile = await h.db.masterProfile.findUniqueOrThrow({ where: { userId: user.id } });
    await h.db.masterProfile.update({ where: { id: profile.id }, data: { verification: 'VERIFIED' } });
    expect((await activate()).status).toBe(409);
    expect((await h.post('/masters/me/services', user.token, { serviceId: service.id })).status).toBe(201);
    expect((await activate()).data.status).toBe('ACTIVE');
    expect((await h.patch('/masters/me/status', user.token, { status: 'BUSY' })).status).toBe(400);
    expect((await h.patch('/masters/me/status', user.token, { status: 'INACTIVE' })).data.status).toBe('INACTIVE');
    await h.db.masterProfile.update({ where: { id: profile.id }, data: { status: 'SUSPENDED' } });
    expect((await activate()).status).toBe(403);
  });

  it('pause/resume: reason required, past dates refused, timed pauses lift themselves', async () => {
    const m = await createMaster(h, service.id);
    expect((await h.post('/masters/me/pause', m.token, {})).status).toBe(400);
    await h.db.masterProfile.update({ where: { id: m.masterId }, data: { status: 'INACTIVE' } });
    expect((await h.post('/masters/me/pause', m.token, { reason: 'Vacation' })).status).toBe(400);
    await h.db.masterProfile.update({ where: { id: m.masterId }, data: { status: 'ACTIVE' } });
    expect((await h.post('/masters/me/pause', m.token, { reason: 'x', until: '2020-01-01T00:00:00Z' })).status).toBe(400);
    const paused = await h.post('/masters/me/pause', m.token, { reason: 'Vacation', until: new Date(Date.now() + 3_600_000).toISOString() });
    expect(paused.data).toMatchObject({ isPaused: true, pauseReason: 'Vacation' });
    expect((await h.get('/masters?limit=100', customer.token)).data.items.map((x: any) => x.id)).not.toContain(m.masterId);
    await h.db.masterProfile.update({ where: { id: m.masterId }, data: { pausedUntil: new Date(Date.now() - 1000) } });
    await h.app.get(MasterService).liftExpiredPauses();
    expect((await h.db.masterProfile.findUniqueOrThrow({ where: { id: m.masterId } })).isPaused).toBe(false);
    await h.post('/masters/me/pause', m.token, { reason: 'Indefinite' });
    await h.app.get(MasterService).liftExpiredPauses();
    expect((await h.db.masterProfile.findUniqueOrThrow({ where: { id: m.masterId } })).isPaused).toBe(true);
    expect((await h.post('/masters/me/resume', m.token)).data.isPaused).toBe(false);
  });

  it('public directory: only ACTIVE + VERIFIED + unpaused masters, no contact data, filterable and paginated', async () => {
    const shown = await createMaster(h, service.id, { firstName: 'Visible' });
    await h.db.masterProfile.update({ where: { id: shown.masterId }, data: { profession: 'Zebra-tester' } });
    const hidden = await createMaster(h, service.id);
    await h.db.masterProfile.update({ where: { id: hidden.masterId }, data: { verification: 'PENDING', profession: 'Zebra-tester' } });

    const list = await h.get('/masters?q=zebra-tester', customer.token);
    expect(list.data.items.map((m: any) => m.id)).toEqual([shown.masterId]);
    const text = JSON.stringify(list.body);
    expect(text).not.toContain(shown.phone);
    expect(text).not.toMatch(/phone|email|latitude|longitude|documentUrl/);
    expect((await h.get(`/masters/${hidden.masterId}`, customer.token)).status).toBe(404);
    expect((await h.get(`/masters/${shown.masterId}`, customer.token)).status).toBe(200);
    expect((await h.get(`/masters?serviceId=${service.id}&limit=1`, customer.token)).data.items).toHaveLength(1);
    expect((await h.get(`/masters?serviceId=${MISSING_UUID}`, customer.token)).data.items).toEqual([]);
    expect((await h.get('/masters?minRating=9', customer.token)).status).toBe(400);
    expect((await h.get('/masters', undefined)).status).toBe(401);
  });
});

describe('S01b — coverage: which masters can reach an address', () => {
  it('returns only masters whose radius contains the point, hides exact coordinates, and orders by distance', async () => {
    const near = await createMaster(h, service.id, { latitude: 41.3, longitude: 69.24, workRadiusKm: 10 });
    const far = await createMaster(h, service.id, { latitude: 41.3, longitude: 69.24, workRadiusKm: 1 });
    const paused = await createMaster(h, service.id, { latitude: 41.3, longitude: 69.24, workRadiusKm: 10 });
    await h.db.masterProfile.update({ where: { id: paused.masterId }, data: { isPaused: true } });
    const point = 'lat=41.33&lon=69.24'; // ~3.3 km dan
    const res = await h.get(`/masters/coverage?${point}`, customer.token);
    expect(res.status).toBe(200);
    const ids = res.data.items.map((m: any) => m.id);
    expect(ids).toContain(near.masterId);
    expect(ids).not.toContain(far.masterId);
    expect(ids).not.toContain(paused.masterId);
    const item = res.data.items.find((m: any) => m.id === near.masterId);
    expect(item.distanceKm).toBeGreaterThan(3);
    expect(item.coverage).toMatchObject({ lat: 41.3, lon: 69.24, radiusKm: 10 });
    expect(JSON.stringify(res.body)).not.toMatch(/latitude|longitude|phone|email/);
    expect((await h.get('/masters/coverage?lat=999&lon=1', customer.token)).status).toBe(400);
    expect((await h.get(`/masters/coverage?${point}`, undefined)).status).toBe(401);
    const single = await h.get(`/masters/${near.masterId}`, customer.token);
    expect(single.data.coverage).toMatchObject({ radiusKm: 10 });
  });
});

describe('S02 — availability', () => {
  it('rejects overlaps and invalid windows, allows adjacency, and is owner-scoped', async () => {
    const m = await createMaster(h, service.id);
    const rival = await createMaster(h, service.id);
    const base = '/masters/me/availability';
    const mon = await h.post(base, m.token, { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' });
    expect(mon.status).toBe(201);
    expect((await h.post(base, m.token, { dayOfWeek: 1, startTime: '12:00', endTime: '15:00' })).status).toBe(409);
    expect((await h.post(base, m.token, { dayOfWeek: 1, startTime: '08:00', endTime: '09:01' })).status).toBe(409);
    expect((await h.post(base, m.token, { dayOfWeek: 1, startTime: '10:00', endTime: '11:00' })).status).toBe(409);
    const adjacent = await h.post(base, m.token, { dayOfWeek: 1, startTime: '13:00', endTime: '18:00' });
    expect(adjacent.status).toBe(201);
    expect((await h.post(base, m.token, { dayOfWeek: 2, startTime: '09:00', endTime: '13:00' })).status).toBe(201);
    for (const bad of [{ dayOfWeek: 7, startTime: '09:00', endTime: '10:00' }, { dayOfWeek: -1, startTime: '09:00', endTime: '10:00' }, { dayOfWeek: 1, startTime: '9:00', endTime: '10:00' }, { dayOfWeek: 1, startTime: '10:00', endTime: '10:00' }, { dayOfWeek: 1, startTime: '18:00', endTime: '09:00' }, { dayOfWeek: 3, startTime: '09:00', endTime: '24:00' }, { dayOfWeek: 3, startTime: '09:00', endTime: '10:00', effectiveFrom: '2027-01-02', effectiveUntil: '2027-01-01' }]) {
      expect((await h.post(base, m.token, bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await h.patch(`${base}/${adjacent.data.id}`, m.token, { startTime: '12:00' })).status).toBe(409);
    expect((await h.patch(`${base}/${adjacent.data.id}`, m.token, { endTime: '20:00' })).data.endTime).toBe('20:00');
    expect((await h.patch(`${base}/${mon.data.id}`, rival.token, { endTime: '12:00' })).status).toBe(404);
    expect((await h.del(`${base}/${mon.data.id}`, rival.token)).status).toBe(404);
    expect((await h.get(base, rival.token)).data).toEqual([]);
    expect((await h.get(base, customer.token)).status).toBe(403);
    expect((await h.del(`${base}/${mon.data.id}`, m.token)).status).toBe(200);
  });

  it('concurrent creates of the same window leave exactly one; concurrent overlapping ones never coexist', async () => {
    const m = await createMaster(h, service.id);
    const base = '/masters/me/availability';
    const same = await Promise.all(Array.from({ length: 8 }, () => h.post(base, m.token, { dayOfWeek: 3, startTime: '10:00', endTime: '12:00' })));
    expect(same.filter((r) => r.status === 201)).toHaveLength(1);
    expect(same.filter((r) => r.status === 409)).toHaveLength(7);

    const shifted = await Promise.all(
      Array.from({ length: 6 }, (_, i) => h.post(base, m.token, { dayOfWeek: 4, startTime: `${String(9 + i).padStart(2, '0')}:00`, endTime: `${String(11 + i).padStart(2, '0')}:00` })),
    );
    expect(shifted.filter((r) => r.status === 201).length).toBeGreaterThanOrEqual(1);
    const rows = await h.db.masterAvailability.findMany({ where: { masterId: m.masterId, dayOfWeek: 4 }, orderBy: { startTime: 'asc' } });
    for (let i = 1; i < rows.length; i += 1) expect(rows[i]!.startTime >= rows[i - 1]!.endTime).toBe(true);
  });
});

describe('S03 — portfolio & private media', () => {
  it('portfolio items require the master’s own READY portfolio media; strangers cannot view unattached files', async () => {
    const m = await createMaster(h, service.id);
    const rival = await createMaster(h, service.id);
    const asset = await uploadImage(h, m.token, 'MASTER_PORTFOLIO', 'MasterProfile', m.masterId, 70);
    const rivalAsset = await uploadImage(h, rival.token, 'MASTER_PORTFOLIO', 'MasterProfile', rival.masterId, 71);

    const form = new FormData();
    form.set('kind', 'MASTER_PORTFOLIO'); form.set('linkType', 'MasterProfile'); form.set('linkId', rival.masterId);
    form.set('file', new Blob([new Uint8Array(10)], { type: 'image/png' }), 'x.png');
    expect((await h.api('POST', '/media/uploads', { token: m.token, form })).status).toBe(403);

    expect((await h.get(`/media/${asset}/thumbnail`, customer.token)).status).toBe(403);
    expect((await h.get(`/media/${asset}/thumbnail`, m.token)).status).toBe(200);

    expect((await h.post('/masters/me/portfolio', m.token, { mediaAssetId: rivalAsset })).status).toBe(403);
    expect((await h.post('/masters/me/portfolio', m.token, { mediaAssetId: MISSING_UUID })).status).toBe(403);
    expect((await h.post('/masters/me/portfolio', m.token, { mediaAssetId: 'nope' })).status).toBe(400);
    const item = await h.post('/masters/me/portfolio', m.token, { mediaAssetId: asset, title: 'Bathroom' });
    expect(item.status).toBe(201);
    expect((await h.post('/masters/me/portfolio', m.token, { mediaAssetId: asset })).status).toBe(409);

    expect(item.data.status).toBe('PENDING');
    expect((await h.get(`/media/${asset}/thumbnail`, customer.token)).status).toBe(403);
    expect((await h.get(`/masters/${m.masterId}`, customer.token)).data.portfolio).toEqual([]);
    expect((await h.get('/admin/portfolio?limit=100', customer.token)).status).toBe(403);
    const queue = await h.get('/admin/portfolio?limit=100', admin.token);
    expect(queue.data.items.map((entry: any) => entry.id)).toContain(item.data.id);
    expect((await h.post(`/admin/portfolio/${item.data.id}/review`, admin.token, { decision: 'REJECT' })).status).toBe(400);

    expect((await h.post(`/admin/portfolio/${item.data.id}/review`, admin.token, { decision: 'APPROVE' })).status).toBe(201);
    expect((await h.post(`/admin/portfolio/${item.data.id}/review`, admin.token, { decision: 'APPROVE' })).status).toBe(409);
    expect((await h.get(`/media/${asset}/thumbnail`, customer.token)).status).toBe(200);
    const page = await h.get(`/masters/${m.masterId}`, customer.token);
    expect(page.data.portfolio.map((p: any) => p.mediaAssetId)).toEqual([asset]);

    const renamed = await h.patch(`/masters/me/portfolio/${item.data.id}`, m.token, { title: 'Renamed' });
    expect(renamed.data).toMatchObject({ title: 'Renamed', status: 'PENDING' });
    expect((await h.get(`/masters/${m.masterId}`, customer.token)).data.portfolio).toEqual([]);
    const rejected = await h.post(`/admin/portfolio/${item.data.id}/review`, admin.token, { decision: 'REJECT', reason: 'Sifati past' });
    expect(rejected.data).toMatchObject({ status: 'REJECTED', rejectReason: 'Sifati past' });
    expect((await h.get(`/media/${asset}/thumbnail`, customer.token)).status).toBe(403);
    expect((await h.patch(`/masters/me/portfolio/${item.data.id}`, rival.token, { title: 'hijack' })).status).toBe(404);
    expect((await h.del(`/masters/me/portfolio/${item.data.id}`, rival.token)).status).toBe(404);
  });

  it('deleting an item removes the database rows and the stored objects', async () => {
    const m = await createMaster(h, service.id);
    const asset = await uploadImage(h, m.token, 'MASTER_PORTFOLIO', 'MasterProfile', m.masterId, 72);
    const item = await h.post('/masters/me/portfolio', m.token, { mediaAssetId: asset });
    const signed = (await h.get(`/media/${asset}/original`, m.token)).data.url as string;
    expect((await fetch(signed)).status).toBe(200);
    expect((await h.del(`/masters/me/portfolio/${item.data.id}`, m.token)).status).toBe(200);
    expect(await h.db.mediaAsset.count({ where: { id: asset } })).toBe(0);
    expect((await fetch(signed)).status).toBe(404);
  });

  it('caps a portfolio at 20 items', async () => {
    const m = await createMaster(h, service.id);
    await h.db.masterPortfolio.createMany({ data: Array.from({ length: 20 }, (_, i) => ({ masterId: m.masterId, title: `t${i}` })) });
    const asset = await uploadImage(h, m.token, 'MASTER_PORTFOLIO', 'MasterProfile', m.masterId, 73);
    expect((await h.post('/masters/me/portfolio', m.token, { mediaAssetId: asset })).status).toBe(409);
  });
});

describe('S05 — trust / verification', () => {
  it('documents are private, reviewed by admins only, and drive the master’s verified state', async () => {
    const user = await aspirant();
    const rival = await createMaster(h, service.id);
    await h.post('/masters/me', user.token, { profession: 'Welder' });
    const profile = await h.db.masterProfile.findUniqueOrThrow({ where: { userId: user.id } });
    await h.post('/masters/me/services', user.token, { serviceId: service.id });

    const doc = await uploadImage(h, user.token, 'MASTER_VERIFICATION_DOCUMENT', 'MasterProfile', profile.id, 80);
    expect((await h.get(`/media/${doc}/original`, user.token)).status).toBe(200);
    expect((await h.get(`/media/${doc}/original`, admin.token)).status).toBe(200);
    expect((await h.get(`/media/${doc}/original`, customer.token)).status).toBe(403);
    expect((await h.get(`/media/${doc}/original`, rival.token)).status).toBe(403);

    const asPortfolio = await uploadImage(h, user.token, 'MASTER_PORTFOLIO', 'MasterProfile', profile.id, 81);
    expect((await h.post('/trust/verifications', user.token, { documentType: 'IDENTITY', mediaAssetId: asPortfolio })).status).toBe(403);
    expect((await h.post('/trust/verifications', customer.token, { documentType: 'IDENTITY', mediaAssetId: doc })).status).toBe(403);
    expect((await h.post('/trust/verifications', rival.token, { documentType: 'IDENTITY', mediaAssetId: doc })).status).toBe(403);
    expect((await h.post('/trust/verifications', user.token, { documentType: 'PASSPORT', mediaAssetId: doc })).status).toBe(400);
    const submitted = await h.post('/trust/verifications', user.token, { documentType: 'IDENTITY', mediaAssetId: doc });
    expect(submitted.status).toBe(201);
    expect(submitted.data.status).toBe('PENDING');
    expect((await h.get('/trust/status', user.token)).data.verification).toBe('UNDER_REVIEW');
    expect((await h.post('/trust/verifications', user.token, { documentType: 'IDENTITY', mediaAssetId: doc })).status).toBe(409);

    const queue = '/trust/admin/verifications';
    expect((await h.get(queue, user.token)).status).toBe(403);
    expect((await h.get(queue, customer.token)).status).toBe(403);
    expect((await h.get(`${queue}?limit=100`, admin.token)).data.items.map((d: any) => d.id)).toContain(submitted.data.id);
    const review = (decision: string, reason?: string, token = admin.token) => h.post(`${queue}/${submitted.data.id}/review`, token, { decision, reason });
    expect((await review('APPROVE', undefined, user.token)).status).toBe(403);
    expect((await review('REJECT')).status).toBe(400);
    expect((await review('MAYBE')).status).toBe(400);

    expect((await review('REQUEST_CORRECTION', 'Photo is blurry')).status).toBe(201);
    expect((await h.get('/trust/status', user.token)).data.verification).toBe('CORRECTION_REQUESTED');
    expect((await review('APPROVE')).status).toBe(409);
    expect(await h.db.notification.count({ where: { userId: user.id, template: 'trust.review' } })).toBe(1);

    const doc2 = await uploadImage(h, user.token, 'MASTER_VERIFICATION_DOCUMENT', 'MasterProfile', profile.id, 82);
    // Tuzatish so‘ralgan hujjat o‘rniga yangisini yuborish mumkin: eskisi nofaol (INACTIVE) bo‘ladi.
    const second = await h.post('/trust/verifications', user.token, { documentType: 'IDENTITY', mediaAssetId: doc2 });
    expect(second.status).toBe(201);
    expect((await h.db.masterVerification.findUniqueOrThrow({ where: { id: submitted.data.id } })).status).toBe('INACTIVE');
    expect((await h.get('/trust/status', user.token)).data.verification).toBe('UNDER_REVIEW');
    expect((await h.del(`/trust/verifications/${submitted.data.id}`, rival.token)).status).toBe(404);
    const removed = await h.del(`/trust/verifications/${submitted.data.id}`, user.token);
    expect(removed.status).toBe(200);
    expect(removed.data).toMatchObject({ deleted: true, verification: 'UNDER_REVIEW' });
    expect(await h.db.mediaAsset.count({ where: { id: doc } })).toBe(0);
    const race = await Promise.all(Array.from({ length: 4 }, () => h.post(`${queue}/${second.data.id}/review`, admin.token, { decision: 'APPROVE' })));
    expect(race.filter((r) => r.status === 201)).toHaveLength(1);
    expect(race.filter((r) => r.status === 409)).toHaveLength(3);
    expect(await h.db.auditLog.count({ where: { action: 'VERIFICATION_APPROVE', targetId: second.data.id } })).toBe(1);
    expect((await h.get('/trust/status', user.token)).data.verification).toBe('VERIFIED');

    expect((await h.patch('/masters/me/status', user.token, { status: 'ACTIVE' })).data.status).toBe('ACTIVE');
    expect((await h.get(`/masters/${profile.id}`, customer.token)).status).toBe(200);

    await h.db.masterVerification.update({ where: { id: second.data.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await h.app.get(TrustService).expireLapsed()).toBe(1);
    const after = await h.db.masterProfile.findUniqueOrThrow({ where: { id: profile.id } });
    expect(after.verification).toBe('EXPIRED');
    expect(after.status).toBe('INACTIVE');
    expect((await h.get(`/masters/${profile.id}`, customer.token)).status).toBe(404);
    expect((await h.patch('/masters/me/status', user.token, { status: 'ACTIVE' })).status).toBe(409);
  });

  it('deleting a verified identity document drops the master back to unverified and inactive', async () => {
    const m = await createMaster(h, service.id);
    const identity = await h.db.masterVerification.create({
      data: { masterId: m.masterId, documentType: 'IDENTITY', status: 'VERIFIED' },
    });
    expect((await h.db.masterProfile.findUniqueOrThrow({ where: { id: m.masterId } })).status).toBe('ACTIVE');

    const removed = await h.del(`/trust/verifications/${identity.id}`, m.token);
    expect(removed.status).toBe(200);
    const after = await h.db.masterProfile.findUniqueOrThrow({ where: { id: m.masterId } });
    expect(after.verification).toBe('PENDING');
    expect(after.status).toBe('INACTIVE');
    expect(await h.db.masterVerification.count({ where: { masterId: m.masterId } })).toBe(0);
  });

  it('allows only one license at a time; a new one needs the old one deleted first', async () => {
    const m = await createMaster(h, service.id);
    const first = await uploadImage(h, m.token, 'MASTER_VERIFICATION_DOCUMENT', 'MasterProfile', m.masterId, 90);
    const second = await uploadImage(h, m.token, 'MASTER_VERIFICATION_DOCUMENT', 'MasterProfile', m.masterId, 91);
    const created = await h.post('/trust/verifications', m.token, { documentType: 'LICENSE', mediaAssetId: first });
    expect(created.status).toBe(201);
    const blocked = await h.post('/trust/verifications', m.token, { documentType: 'LICENSE', mediaAssetId: second });
    expect(blocked.status).toBe(409);
    expect(JSON.stringify(blocked.body)).toContain('Litsenziya');
    expect((await h.post('/trust/verifications', m.token, { documentType: 'CERTIFICATE', mediaAssetId: second })).status).toBe(201);

    expect((await h.del(`/trust/verifications/${created.data.id}`, m.token)).status).toBe(200);
    const third = await uploadImage(h, m.token, 'MASTER_VERIFICATION_DOCUMENT', 'MasterProfile', m.masterId, 92);
    expect((await h.post('/trust/verifications', m.token, { documentType: 'LICENSE', mediaAssetId: third })).status).toBe(201);
  });

  it('a master can only read their own documents; unknown ids are 404/400', async () => {
    const a = await createMaster(h, service.id);
    const b = await createMaster(h, service.id);
    const doc = await uploadImage(h, a.token, 'MASTER_VERIFICATION_DOCUMENT', 'MasterProfile', a.masterId, 83);
    await h.post('/trust/verifications', a.token, { documentType: 'LICENSE', mediaAssetId: doc });
    expect((await h.get('/trust/verifications', a.token)).data).toHaveLength(1);
    expect((await h.get('/trust/verifications', b.token)).data).toEqual([]);
    expect(JSON.stringify((await h.get('/trust/verifications', a.token)).body)).not.toMatch(/reviewedById|storageKey|originalKey/);
    expect((await h.get(`/trust/admin/verifications/${MISSING_UUID}`, admin.token)).status).toBe(404);
    expect((await h.get('/trust/admin/verifications/nope', admin.token)).status).toBe(400);
  });
});

describe('S04 — service catalog', () => {
  it('reads are public; writes are ADMIN-only and audited; slugs stay unique', async () => {
    expect((await h.get('/service-categories')).status).toBe(200);
    expect((await h.get('/services?limit=2')).data.items).toHaveLength(2);
    expect((await h.post('/service-categories', customer.token, { name: 'Hack' })).status).toBe(403);
    expect((await h.post('/service-categories', undefined, { name: 'Hack' })).status).toBe(401);
    const a = await h.post('/service-categories', admin.token, { name: 'Catalog Test' });
    const b = await h.post('/service-categories', admin.token, { name: 'Catalog Test' });
    expect(a.status).toBe(201);
    expect(a.data.slug).toBe('catalog-test');
    expect(b.data.slug).toBe('catalog-test-2');
    expect((await h.post('/service-categories', admin.token, { name: '' })).status).toBe(400);
    expect((await h.post('/services', admin.token, { categoryId: MISSING_UUID, name: 'X' })).status).toBe(404);
    const svc = await h.post('/services', admin.token, { categoryId: a.data.id, name: 'Catalog Service', description: 'd' });
    expect(svc.status).toBe(201);
    expect((await h.patch(`/services/${svc.data.id}`, customer.token, { name: 'x' })).status).toBe(403);
    expect((await h.patch(`/services/${svc.data.id}`, admin.token, { name: 'Renamed' })).data.name).toBe('Renamed');
    expect(await h.db.auditLog.count({ where: { targetId: svc.data.id, actorId: admin.id } })).toBeGreaterThanOrEqual(1);
    expect((await h.get(`/services/${svc.data.id}`)).data.category.id).toBe(a.data.id);
  });

  it('deactivation hides services everywhere: catalog, requests, master offerings; category deactivation cascades', async () => {
    const cat = (await h.post('/service-categories', admin.token, { name: 'Cascade Cat' })).data;
    const svc = (await h.post('/services', admin.token, { categoryId: cat.id, name: 'Cascade Svc' })).data;
    const m = await createMaster(h, service.id);
    expect((await h.post('/masters/me/services', m.token, { serviceId: svc.id, basePrice: 5000, estimatedMinutes: 30 })).status).toBe(201);

    expect((await h.del(`/service-categories/${cat.id}`, customer.token)).status).toBe(403);
    expect((await h.del(`/service-categories/${cat.id}`, admin.token)).status).toBe(200);
    expect((await h.db.service.findUniqueOrThrow({ where: { id: svc.id } })).isActive).toBe(false);
    expect((await h.get(`/services/${svc.id}`)).status).toBe(404);
    expect((await h.get('/service-categories')).data.map((c: any) => c.id)).not.toContain(cat.id);
    expect((await h.post('/problem-requests', customer.token, { title: 'Inactive', description: 'uses an inactive service', serviceId: svc.id })).status).toBe(400);
    expect((await h.post('/masters/me/services', (await createMaster(h, service.id)).token, { serviceId: svc.id })).status).toBe(400);
    expect((await h.post('/services', admin.token, { categoryId: cat.id, name: 'Late' })).status).toBe(409);
  });

  it('a master’s offerings are their own: CRUD, BOLA and validation', async () => {
    const m = await createMaster(h, service.id);
    const rival = await createMaster(h, service.id);
    const services = await h.db.service.findMany({ where: { isActive: true }, take: 3, orderBy: { sortOrder: 'asc' } });
    const extra = services.find((s) => s.id !== service.id)!;
    for (const bad of [{ serviceId: extra.id, basePrice: -1 }, { serviceId: extra.id, basePrice: 0 }, { serviceId: extra.id, estimatedMinutes: 2 }, { serviceId: extra.id, estimatedMinutes: 5000 }, { serviceId: 'nope' }, { serviceId: extra.id, masterId: rival.masterId }]) {
      expect((await h.post('/masters/me/services', m.token, bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await h.post('/masters/me/services', m.token, { serviceId: service.id })).status).toBe(409);
    expect((await h.post('/masters/me/services', m.token, { serviceId: extra.id, basePrice: 90000, estimatedMinutes: 45 })).status).toBe(201);
    expect((await h.patch(`/masters/me/services/${extra.id}`, m.token, { basePrice: 95000 })).data.basePrice).toBe('95000');
    expect((await h.patch(`/masters/me/services/${extra.id}`, rival.token, { basePrice: 1 })).status).toBe(404);
    expect((await h.del(`/masters/me/services/${extra.id}`, rival.token)).status).toBe(404);
    expect((await h.get('/masters/me/services', m.token)).data).toHaveLength(2);
    expect((await h.get('/masters/me/services', customer.token)).status).toBe(403);
    await h.del(`/masters/me/services/${extra.id}`, m.token);
    await h.del(`/masters/me/services/${service.id}`, m.token);
    expect((await h.db.masterProfile.findUniqueOrThrow({ where: { id: m.masterId } })).status).toBe('INACTIVE');
    void waitFor;
  });
});
