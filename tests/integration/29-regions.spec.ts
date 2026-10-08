import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createUser, firstService, type Harness, type TestUser } from '../helpers/harness';

let h: Harness;
let viewer: TestUser;
let masterUser: TestUser;
let masterId: string;

beforeAll(async () => {
  h = await bootHarness();
  viewer = await createUser(h);
  masterUser = await createUser(h, ['CUSTOMER']);
  const created = await h.post('/masters/me', masterUser.token, { profession: 'Santexnik', latitude: 39.654, longitude: 66.96, workRadiusKm: 10 });
  expect(created.status).toBe(201);
  masterId = created.data.id;
  await h.db.masterProfile.update({ where: { id: masterId }, data: { status: 'ACTIVE', verification: 'VERIFIED', services: { create: { serviceId: (await firstService(h)).id, basePrice: 90000 } } } });
});
afterAll(async () => {
  await h.close();
});

describe('regions', () => {
  it('derives the region from the master location and keeps it in sync when the location changes', async () => {
    expect((await h.db.masterProfile.findUniqueOrThrow({ where: { id: masterId } })).region).toBe('samarqand');
    const moved = await h.api('PATCH', '/masters/me', { token: masterUser.token, body: { latitude: 41.311, longitude: 69.279 } });
    expect(moved.status).toBe(200);
    expect((await h.db.masterProfile.findUniqueOrThrow({ where: { id: masterId } })).region).toBe('toshkent-shahri');
    await h.api('PATCH', '/masters/me', { token: masterUser.token, body: { latitude: 39.654, longitude: 66.96 } });
    expect((await h.db.masterProfile.findUniqueOrThrow({ where: { id: masterId } })).region).toBe('samarqand');
  });

  it('filters the catalog by region (customer and public) and shows the region name', async () => {
    const own = await h.api('GET', '/masters?region=samarqand&limit=50', { token: viewer.token });
    expect(own.status).toBe(200);
    const mine = own.data.items.find((item: { id: string }) => item.id === masterId);
    expect(mine.region).toBe('samarqand');
    expect(mine.regionName).toBe('Samarqand viloyati');
    const other = await h.api('GET', '/masters?region=buxoro&limit=50', { token: viewer.token });
    expect(other.data.items.some((item: { id: string }) => item.id === masterId)).toBe(false);

    const open = await h.api('GET', '/public/masters?region=samarqand&limit=24');
    expect(open.status).toBe(200);
    expect(open.data.items.some((item: { region: string }) => item.region === 'samarqand')).toBe(true);
    expect(open.data.items.every((item: { region: string }) => item.region === 'samarqand')).toBe(true);
    expect((await h.api('GET', '/public/masters?region=atlantida')).status).toBe(400);
    expect((await h.api('GET', '/masters?region=atlantida', { token: viewer.token })).status).toBe(400);
  });

  it('lists all 14 regions with master counts publicly', async () => {
    const res = await h.api('GET', '/public/regions');
    expect(res.status).toBe(200);
    expect(res.data).toHaveLength(14);
    expect(res.data.find((item: { key: string }) => item.key === 'samarqand').masters).toBeGreaterThanOrEqual(1);
    expect(res.data.find((item: { key: string }) => item.key === 'qoraqalpogiston').masters).toBeGreaterThanOrEqual(0);
  });
});
