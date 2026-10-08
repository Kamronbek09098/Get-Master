import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createUser, type Harness, type TestUser } from '../helpers/harness';

let h: Harness;
let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  h = await bootHarness();
  alice = await createUser(h);
  bob = await createUser(h);
});
afterAll(async () => {
  await h.close();
});

describe('push token registration', () => {
  it('requires login and validates input', async () => {
    expect((await h.post('/push/tokens', undefined, { token: 'x' })).status).toBe(401);
    expect((await h.post('/push/tokens', alice.token, {})).status).toBe(400);
    expect((await h.post('/push/tokens', alice.token, { token: 'x', panel: 'staff' })).status).toBe(400);
    expect((await h.post('/push/tokens', alice.token, { token: 'x', platform: 'symbian' })).status).toBe(400);
  });

  it('stores a device token, moves it to the new account on re-register and removes it on logout', async () => {
    const token = `fcm-${Date.now()}-device`;
    const first = await h.post('/push/tokens', alice.token, { token, panel: 'customer', platform: 'android' });
    expect(first.status).toBe(201);
    expect(await h.db.pushToken.count({ where: { token, userId: alice.id } })).toBe(1);
    // Telefon boshqa foydalanuvchiga o‘tsa, token unga ko‘chadi (eski egasiga xabar ketmaydi).
    expect((await h.post('/push/tokens', bob.token, { token, panel: 'master' })).status).toBe(201);
    expect(await h.db.pushToken.count({ where: { token, userId: alice.id } })).toBe(0);
    expect(await h.db.pushToken.count({ where: { token, userId: bob.id } })).toBe(1);
    // Boshqa birovning tokenini o‘chirib bo‘lmaydi.
    const foreign = await h.api('DELETE', '/push/tokens', { token: alice.token, body: { token } });
    expect(foreign.data.removed).toBe(0);
    const own = await h.post('/push/tokens/remove', bob.token, { token });
    expect(own.data.removed).toBe(1);
  });

  it('accepts browser (web) tokens for the admin panel too', async () => {
    const token = `fcm-web-${Date.now()}`;
    expect((await h.post('/push/tokens', alice.token, { token, platform: 'web', panel: 'admin' })).status).toBe(201);
    const row = await h.db.pushToken.findUniqueOrThrow({ where: { token } });
    expect(row.platform).toBe('web');
    expect(row.panel).toBe('admin');
  });

  it('keeps only the 10 most recent devices per user', async () => {
    for (let i = 0; i < 12; i += 1) {
      await h.post('/push/tokens', bob.token, { token: `fcm-many-${Date.now()}-${i}` });
    }
    expect(await h.db.pushToken.count({ where: { userId: bob.id } })).toBeLessThanOrEqual(10);
  });
});
