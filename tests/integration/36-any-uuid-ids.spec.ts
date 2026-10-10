import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createSuperAdmin, type Harness, type TestUser, uniquePhone } from '../helpers/harness';

let h: Harness;
let admin: TestUser;
/** Tayyor (seed) akkauntlar kabi RFC versiya raqamiga mos kelmaydigan id’lar. */
const SEED_IDS = [1, 2, 3].map((n) => `c0000000-0000-0000-0000-${String(900 + n + (Date.now() % 90)).padStart(12, '0')}`);

beforeAll(async () => {
  h = await bootHarness();
  admin = await createSuperAdmin(h);
  for (const id of SEED_IDS) {
    await h.db.user.create({ data: { id, phone: uniquePhone(), status: 'ACTIVE', firstName: 'Tayyor', lastName: 'Akkaunt', phoneVerifiedAt: new Date(), userRoles: { create: [{ role: 'CUSTOMER' }] } } });
  }
});
afterAll(async () => {
  await h.close();
});

describe('ids that are not RFC-4122 versioned UUIDs still work everywhere', () => {
  it('cursor pagination walks the whole admin user list without a 400 even when a page ends on such an id', async () => {
    const seen = new Set<string>();
    let cursor: string | null = null;
    for (let page = 0; page < 200; page += 1) {
      const res = await h.get(`/admin/users?limit=1${cursor ? `&cursor=${cursor}` : ''}`, admin.token);
      expect(res.status, `page ${page} cursor ${cursor}`).toBe(200);
      for (const item of res.data.items) seen.add(item.id);
      cursor = res.data.nextCursor;
      if (!cursor) break;
    }
    for (const id of SEED_IDS) expect(seen.has(id)).toBe(true);
  });

  it('path parameters accept them too, and malformed ids are still rejected with 400', async () => {
    expect((await h.get(`/admin/users/${SEED_IDS[0]}`, admin.token)).status).toBe(200);
    for (const bad of ['not-a-uuid', '12345', 'c0000000-0000-0000-0000-00000000000g', 'c0000000-0000-0000-0000-0000000000011']) {
      expect((await h.get(`/admin/users/${bad}`, admin.token)).status, bad).toBe(400);
      expect((await h.get(`/admin/users?cursor=${bad}`, admin.token)).status, `cursor ${bad}`).toBe(400);
    }
  });
});
