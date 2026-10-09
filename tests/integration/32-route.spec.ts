import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createMaster, firstService, type Harness, type TestMaster } from '../helpers/harness';

let h: Harness;
let master: TestMaster;

beforeAll(async () => {
  h = await bootHarness();
  master = await createMaster(h, (await firstService(h)).id);
});
afterAll(() => h.close());

describe('GET /geo/route (ustaning navigatsiyasi)', () => {
  it('requires a login and valid coordinates', async () => {
    expect((await h.get('/geo/route?fromLat=41.31&fromLon=69.24&toLat=41.33&toLon=69.28')).status).toBe(401);
    expect((await h.get('/geo/route?fromLat=41.31&fromLon=69.24', master.token)).status).toBe(400);
    expect((await h.get('/geo/route?fromLat=999&fromLon=69.24&toLat=41.33&toLon=69.28', master.token)).status).toBe(400);
  });

  it('returns routes with geometry and turn steps, or a clear 503 when the routing server is down', async () => {
    const res = await h.get('/geo/route?fromLat=41.31&fromLon=69.24&toLat=41.33&toLon=69.28', master.token);
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      const route = res.data.routes[0];
      expect(route.distanceM).toBeGreaterThan(0);
      expect(route.geometry.length).toBeGreaterThan(2);
      expect(route.steps.at(-1).type).toBe('arrive');
    }
  });
});
