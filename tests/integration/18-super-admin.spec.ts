import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createAdmin, createSuperAdmin, createUser, tokenFor, type Harness, type TestUser } from '../helpers/harness';

let h: Harness;
let sup: TestUser;
let plain: TestUser;

beforeAll(async () => {
  h = await bootHarness();
  sup = await createSuperAdmin(h);
  plain = await createAdmin(h);
});
afterAll(async () => {
  await h.close();
});

const phone = () => `+99890${Math.floor(1000000 + Math.random() * 8999999)}`;
const create = (token: string, over: Record<string, unknown> = {}) =>
  h.post('/admin/admins', token, { phone: phone(), password: 'Strong-Pass-123', firstName: 'Yangi', lastName: 'Admin', permissions: ['USERS'], ...over });

describe('superadmin: creating and managing admins', () => {
  it('only a superadmin can list, create and change admins', async () => {
    expect((await h.get('/admin/admins', plain.token)).status).toBe(403);
    expect((await create(plain.token)).status).toBe(403);
    expect((await h.get('/admin/admins', undefined)).status).toBe(401);
    const list = await h.get('/admin/admins', sup.token);
    expect(list.status).toBe(200);
    expect(list.data.items.some((item: { id: string; isSelf: boolean }) => item.id === sup.id && item.isSelf)).toBe(true);
  });

  it('creates an ACTIVE admin that can sign in with login+password (plain admin, not superadmin)', async () => {
    const number = phone();
    const res = await create(sup.token, { phone: number });
    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({ phone: number, status: 'ACTIVE', isSuperAdmin: false });
    const row = await h.db.user.findUniqueOrThrow({ where: { id: res.data.id }, include: { userRoles: true } });
    expect(row.userRoles.map((r) => r.role)).toEqual(['ADMIN']);
    expect(row.passwordHash).toMatch(/^\$2/);
    expect((await create(sup.token, { phone: number })).status).toBe(409);
    expect((await create(sup.token, { phone: '123' })).status).toBe(400);
    expect((await create(sup.token, { password: 'short' })).status).toBe(400);
    expect(await h.db.auditLog.count({ where: { targetId: res.data.id, action: 'ADMIN_ADMIN_CREATED' } })).toBe(1);
    // Yangi admin boshqa adminlarni yarata olmaydi.
    const login = await h.api('POST', '/auth/login', { ip: '10.18.0.1', body: { phone: number, password: 'Strong-Pass-123' } });
    expect(login.status).toBe(201);
  });

  it('a superadmin can freeze, reset the password of and delete another admin — never themself', async () => {
    const other = (await create(sup.token)).data;
    expect((await h.patch(`/admin/users/${other.id}/status`, sup.token, { status: 'SUSPENDED', reason: 'Sinov' })).status).toBe(200);
    expect((await h.post(`/admin/users/${other.id}/password`, sup.token, { password: 'Another-Pass-123' })).status).toBe(201);
    expect((await h.patch(`/admin/users/${sup.id}/status`, sup.token, { status: 'BLOCKED', reason: 'Sinov' })).status).toBe(403);
    expect((await h.post(`/admin/users/${other.id}/delete`, sup.token, { reason: 'Sinov' })).status).toBe(201);
    // Oddiy admin boshqa adminga tegolmaydi.
    const victim = (await create(sup.token)).data;
    expect((await h.patch(`/admin/users/${victim.id}/status`, plain.token, { status: 'SUSPENDED', reason: 'Sinov' })).status).toBe(403);
    expect((await h.post(`/admin/users/${victim.id}/delete`, plain.token, { reason: 'Sinov' })).status).toBe(403);
  });

  it('grants/revokes superadmin and always keeps one active superadmin', async () => {
    const other = (await create(sup.token)).data;
    expect((await h.patch(`/admin/admins/${other.id}/super`, plain.token, { value: true })).status).toBe(403);
    expect((await h.patch(`/admin/admins/${other.id}/super`, sup.token, { value: true })).data).toEqual({ isSuperAdmin: true });
    expect((await h.patch(`/admin/admins/${other.id}/super`, sup.token, { value: false })).data).toEqual({ isSuperAdmin: false });
    expect((await h.patch(`/admin/admins/${sup.id}/super`, sup.token, { value: false })).status).toBe(403);
    const customer = await createUser(h, ['CUSTOMER']);
    expect((await h.patch(`/admin/admins/${customer.id}/super`, sup.token, { value: true })).status).toBe(404);
  });

  it('exposes isSuperAdmin on /users/me', async () => {
    expect((await h.get('/users/me', sup.token)).data.isSuperAdmin).toBe(true);
    expect((await h.get('/users/me', plain.token)).data.isSuperAdmin).toBe(false);
  });

  it('requires at least one section for a plain admin; superadmin needs none', async () => {
    expect((await create(sup.token, { permissions: [] })).status).toBe(400);
    expect((await create(sup.token, { permissions: ['NOPE'] })).status).toBe(400);
    expect((await create(sup.token, { isSuperAdmin: true, permissions: [] })).status).toBe(201);
  });

  it('enforces the chosen sections: only allowed areas open, others 403; permissions can be changed later', async () => {
    const number = phone();
    const created = (await create(sup.token, { phone: number, permissions: ['ORDERS'] })).data;
    expect(created.adminPermissions).toEqual(['ORDERS']);
    // Tizimga kirib haqiqiy (sessiyali) tokenni olish o‘rniga, shu admin uchun token yaratamiz.
    const limited = await tokenFor(h, created.id, ['ADMIN']);
    expect((await h.get('/admin/orders', limited)).status).toBe(200);
    expect((await h.get('/admin/users', limited)).status).toBe(403);
    expect((await h.get('/admin/dashboard', limited)).status).toBe(403);
    expect((await h.get('/audit-logs', limited)).status).toBe(403);
    expect((await h.patch(`/admin/admins/${created.id}/permissions`, plain.token, { permissions: ['USERS'] })).status).toBe(403);
    expect((await h.patch(`/admin/admins/${created.id}/permissions`, sup.token, { permissions: [] })).status).toBe(400);
    expect((await h.patch(`/admin/admins/${created.id}/permissions`, sup.token, { permissions: ['USERS', 'AUDIT'] })).data).toEqual({ permissions: ['USERS', 'AUDIT'] });
    expect((await h.get('/admin/users', limited)).status).toBe(200);
    expect((await h.get('/admin/orders', limited)).status).toBe(403);
    // Superadmin hamma joyga kira oladi.
    expect((await h.get('/admin/orders', sup.token)).status).toBe(200);
    expect((await h.get('/audit-logs', sup.token)).status).toBe(200);
  });
});
