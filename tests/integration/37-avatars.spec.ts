import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createAdmin, createSuperAdmin, createUser, type Harness, type TestUser } from '../helpers/harness';

let h: Harness;
let superAdmin: TestUser;
let admin: TestUser;
let customer: TestUser;
let png: Buffer;

const form = (buffer: Buffer, type = 'image/png', name = 'a.png') => {
  const f = new FormData();
  f.append('file', new Blob([new Uint8Array(buffer)], { type }), name);
  return f;
};

beforeAll(async () => {
  h = await bootHarness();
  superAdmin = await createSuperAdmin(h);
  admin = await createAdmin(h, ['USERS']);
  customer = await createUser(h, ['CUSTOMER']);
  png = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#3366cc' } }).png().toBuffer();
});
afterAll(async () => {
  await h.close();
});

describe('profile avatars', () => {
  it('customer uploads own avatar, it is served publicly and shown in /users/me', async () => {
    const up = await h.api('POST', '/users/me/avatar', { token: customer.token, form: form(png) });
    expect(up.status).toBe(201);
    expect(up.data.avatar).toMatch(/^\/avatars\/[0-9a-f-]{36}$/);
    const me = await h.get('/users/me', customer.token);
    expect(me.data.avatar).toBe(up.data.avatar);
    expect(me.data.canSetAvatar).toBe(true);
    const res = await fetch(`${h.baseUrl}/api/v1${up.data.avatar}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(100);
  });

  it('rejects non-images and unknown asset ids', async () => {
    const bad = await h.api('POST', '/users/me/avatar', { token: customer.token, form: form(Buffer.from('hello'), 'text/plain', 'a.txt') });
    expect(bad.status).toBe(400);
    const fake = await fetch(`${h.baseUrl}/api/v1/avatars/11111111-1111-4111-8111-111111111111`);
    expect(fake.status).toBe(404);
  });

  it('replacing the avatar invalidates the old URL; removing clears it', async () => {
    const first = (await h.get('/users/me', customer.token)).data.avatar;
    const second = (await h.api('POST', '/users/me/avatar', { token: customer.token, form: form(png) })).data.avatar;
    expect(second).not.toBe(first);
    expect((await fetch(`${h.baseUrl}/api/v1${first}`)).status).toBe(404);
    expect((await h.del('/users/me/avatar', customer.token)).status).toBe(200);
    expect((await h.get('/users/me', customer.token)).data.avatar).toBeNull();
    expect((await fetch(`${h.baseUrl}/api/v1${second}`)).status).toBe(404);
  });

  it('admin cannot set own avatar until superadmin enables it; superadmin can set admin avatar', async () => {
    expect((await h.get('/users/me', admin.token)).data.canSetAvatar).toBe(false);
    expect((await h.api('POST', '/users/me/avatar', { token: admin.token, form: form(png) })).status).toBe(403);
    // oddiy admin boshqa adminning rasmini qo‘ya olmaydi
    expect((await h.api('POST', `/admin/users/${superAdmin.id}/avatar`, { token: admin.token, form: form(png) })).status).toBe(403);
    // superadmin qo‘ya oladi
    const set = await h.api('POST', `/admin/users/${admin.id}/avatar`, { token: superAdmin.token, form: form(png) });
    expect(set.status).toBe(201);
    // ruxsatni faqat superadmin o‘zgartiradi
    expect((await h.patch(`/admin/admins/${admin.id}/avatar-permission`, admin.token, { allowed: true })).status).toBe(403);
    expect((await h.patch(`/admin/admins/${admin.id}/avatar-permission`, superAdmin.token, { allowed: true })).status).toBe(200);
    expect((await h.get('/users/me', admin.token)).data.canSetAvatar).toBe(true);
    expect((await h.api('POST', '/users/me/avatar', { token: admin.token, form: form(png) })).status).toBe(201);
    expect((await h.patch(`/admin/admins/${admin.id}/avatar-permission`, superAdmin.token, { allowed: false })).status).toBe(200);
    expect((await h.api('POST', '/users/me/avatar', { token: admin.token, form: form(png) })).status).toBe(403);
  });

  it('admin with USERS permission manages customer avatars and it is audited', async () => {
    const set = await h.api('POST', `/admin/users/${customer.id}/avatar`, { token: admin.token, form: form(png) });
    expect(set.status).toBe(201);
    expect(await h.db.auditLog.count({ where: { targetId: customer.id, action: 'ADMIN_USER_AVATAR_SET' } })).toBe(1);
    expect((await h.del(`/admin/users/${customer.id}/avatar`, admin.token)).status).toBe(200);
    expect((await h.get('/users/me', customer.token)).data.avatar).toBeNull();
  });
});
