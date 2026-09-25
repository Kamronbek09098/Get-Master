import * as bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createAdmin, createMaster, createUser, firstService, type Harness, type TestMaster, type TestUser } from '../helpers/harness';

let h: Harness;
let admin: TestUser;
let service: { id: string; categoryId: string };

beforeAll(async () => {
  h = await bootHarness();
  admin = await createAdmin(h);
  service = await firstService(h);
});
afterAll(async () => {
  await h.close();
});

const setStatus = (token: string | undefined, id: string, body: unknown) => h.patch(`/admin/users/${id}/status`, token, body);
const remove = (token: string | undefined, id: string, body: unknown) => h.post(`/admin/users/${id}/delete`, token, body);

describe('GET /admin/users — customers and masters together', () => {
  let customer: TestUser;
  let master: TestMaster;
  beforeAll(async () => {
    customer = await createUser(h, ['CUSTOMER'], { firstName: 'Zafarlist' });
    master = await createMaster(h, service.id, { firstName: 'Zafarmaster' });
  });

  it('lists both roles with role badges and master details, never admins', async () => {
    const res = await h.get('/admin/users?search=Zafar&limit=50', admin.token);
    expect(res.status).toBe(200);
    const byId = new Map<string, any>(res.data.items.map((item: { id: string }) => [item.id, item]));
    expect(byId.get(customer.id)).toMatchObject({ roles: ['CUSTOMER'], masterProfile: null });
    expect(byId.get(master.id)).toMatchObject({ masterProfile: { verification: 'VERIFIED', status: 'ACTIVE' } });
    expect(byId.get(master.id).roles).toEqual(expect.arrayContaining(['MASTER']));
    expect(res.data.items.some((item: { roles: string[] }) => item.roles.includes('ADMIN'))).toBe(false);
  });

  it('filters by role, status and search', async () => {
    const masters = await h.get('/admin/users?role=MASTER&search=Zafar', admin.token);
    expect(masters.data.items.map((item: { id: string }) => item.id)).toEqual([master.id]);
    const customers = await h.get('/admin/users?role=CUSTOMER&search=Zafarlist', admin.token);
    expect(customers.data.items.map((item: { id: string }) => item.id)).toEqual([customer.id]);
    const byPhone = await h.get(`/admin/users?search=${encodeURIComponent(customer.phone)}`, admin.token);
    expect(byPhone.data.items.map((item: { id: string }) => item.id)).toContain(customer.id);
    const suspended = await h.get('/admin/users?status=SUSPENDED&search=Zafarlist', admin.token);
    expect(suspended.data.items).toEqual([]);
    expect((await h.get('/admin/users?role=ADMIN', admin.token)).status).toBe(400);
  });

  it('is admin-only', async () => {
    expect((await h.get('/admin/users', customer.token)).status).toBe(403);
    expect((await h.get('/admin/users', master.token)).status).toBe(403);
    expect((await h.get('/admin/users')).status).toBe(401);
  });

  it('paginates with a cursor', async () => {
    for (let i = 0; i < 3; i += 1) await createUser(h, ['CUSTOMER']);
    const first = await h.get('/admin/users?limit=2', admin.token);
    expect(first.data.items).toHaveLength(2);
    expect(first.data.nextCursor).toBeTruthy();
    const second = await h.get(`/admin/users?limit=2&cursor=${first.data.nextCursor}`, admin.token);
    expect(second.data.items.length).toBeGreaterThan(0);
    expect(second.data.items[0].id).not.toBe(first.data.items[0].id);
  });
});

describe('freeze / block / reactivate', () => {
  it('freezing takes effect at once: the user loses access, cannot log in, and the master profile is suspended', async () => {
    const master = await createMaster(h, service.id);
    const password = 'Str0ng-Passw0rd!';
    await h.db.user.update({ where: { id: master.id }, data: { passwordHash: await bcrypt.hash(password, 4) } });
    expect((await h.get('/masters/me', master.token)).status).toBe(200);

    const res = await setStatus(admin.token, master.id, { status: 'SUSPENDED', reason: 'Shubhali faollik' });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ status: 'SUSPENDED', masterProfile: { status: 'SUSPENDED' } });

    expect((await h.get('/masters/me', master.token)).status).toBe(401);
    const login = await h.api('POST', '/auth/login', { ip: '10.9.1.1', body: { phone: master.phone, password } });
    expect(login.status).toBe(403);
    expect(await h.db.deviceSession.count({ where: { userId: master.id, status: 'ACTIVE' } })).toBe(0);

    const audit = await h.db.auditLog.findFirst({ where: { targetId: master.id, action: 'ADMIN_USER_SUSPENDED' } });
    expect(audit).toMatchObject({ actorId: admin.id, reason: 'Shubhali faollik' });
  });

  it('blocking behaves the same and is recorded separately', async () => {
    const user = await createUser(h, ['CUSTOMER']);
    const res = await setStatus(admin.token, user.id, { status: 'BLOCKED', reason: 'Qoidabuzarlik' });
    expect(res.data.status).toBe('BLOCKED');
    expect((await h.get('/customers/me', user.token)).status).toBe(401);
    expect(await h.db.auditLog.count({ where: { targetId: user.id, action: 'ADMIN_USER_BLOCKED' } })).toBe(1);
  });

  it('reactivation lifts the restriction (user signs in again); a master profile comes back INACTIVE, not ACTIVE', async () => {
    const master = await createMaster(h, service.id);
    await setStatus(admin.token, master.id, { status: 'BLOCKED', reason: 'Sinov' });
    const res = await setStatus(admin.token, master.id, { status: 'ACTIVE' });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ status: 'ACTIVE', masterProfile: { status: 'INACTIVE' } });
    expect(await h.db.auditLog.count({ where: { targetId: master.id, action: 'ADMIN_USER_REACTIVATED' } })).toBe(1);
  });

  it('requires a reason to restrict, and only reactivates restricted accounts', async () => {
    const user = await createUser(h, ['CUSTOMER']);
    expect((await setStatus(admin.token, user.id, { status: 'SUSPENDED' })).status).toBe(400);
    expect((await setStatus(admin.token, user.id, { status: 'SUSPENDED', reason: 'ab' })).status).toBe(400);
    expect((await setStatus(admin.token, user.id, { status: 'ACTIVE' })).status).toBe(409);
    expect((await setStatus(admin.token, user.id, { status: 'DELETED', reason: 'xxx' })).status).toBe(400);
    expect((await h.get('/customers/me', user.token)).status).toBe(200);
  });

  it('cannot be applied to admins or to yourself, and is admin-only', async () => {
    const other = await createAdmin(h);
    const user = await createUser(h, ['CUSTOMER']);
    expect((await setStatus(admin.token, other.id, { status: 'BLOCKED', reason: 'Sinov' })).status).toBe(403);
    expect((await setStatus(admin.token, admin.id, { status: 'BLOCKED', reason: 'Sinov' })).status).toBe(403);
    expect((await remove(admin.token, other.id, { reason: 'Sinov' })).status).toBe(403);
    expect((await setStatus(user.token, user.id, { status: 'BLOCKED', reason: 'Sinov' })).status).toBe(403);
    expect((await setStatus(undefined, user.id, { status: 'BLOCKED', reason: 'Sinov' })).status).toBe(401);
    expect((await setStatus(admin.token, '00000000-0000-4000-8000-00000000dead', { status: 'BLOCKED', reason: 'Sinov' })).status).toBe(404);
  });
});

describe('delete', () => {
  it('soft-deletes: access is gone, the row and its history stay, and it drops out of the default list', async () => {
    const master = await createMaster(h, service.id);
    const res = await remove(admin.token, master.id, { reason: 'Foydalanuvchi so‘rovi bo‘yicha' });
    expect(res.status).toBe(201);
    expect(res.data).toEqual({ deleted: true });

    expect((await h.get('/masters/me', master.token)).status).toBe(401);
    const row = await h.db.user.findUniqueOrThrow({ where: { id: master.id }, include: { masterProfile: true } });
    expect(row.status).toBe('DELETED');
    expect(row.deletedAt).not.toBeNull();
    expect(row.masterProfile?.status).toBe('SUSPENDED');
    expect(await h.db.auditLog.count({ where: { targetId: master.id, action: 'ADMIN_USER_DELETED' } })).toBe(1);

    const active = await h.get(`/admin/users?search=${encodeURIComponent(master.phone)}`, admin.token);
    expect(active.data.items).toEqual([]);
    const deleted = await h.get(`/admin/users?status=DELETED&search=${encodeURIComponent(master.phone)}`, admin.token);
    expect(deleted.data.items.map((item: { id: string }) => item.id)).toEqual([master.id]);
  });

  it('needs a reason, cannot repeat, and cannot be undone through the status endpoint', async () => {
    const user = await createUser(h, ['CUSTOMER']);
    expect((await remove(admin.token, user.id, {})).status).toBe(400);
    expect((await remove(admin.token, user.id, { reason: 'ab' })).status).toBe(400);
    expect((await remove(admin.token, user.id, { reason: 'Sinov o‘chirish' })).status).toBe(201);
    expect((await remove(admin.token, user.id, { reason: 'Yana o‘chirish' })).status).toBe(404);
    expect((await setStatus(admin.token, user.id, { status: 'ACTIVE' })).status).toBe(409);
    expect((await remove(undefined, user.id, { reason: 'Sinov' })).status).toBe(401);
  });
});

describe('account numbers', () => {
  it('are sequential from 571, unique, never change and are not tied to names', async () => {
    const a = await createUser(h, ['CUSTOMER'], { firstName: 'Bir Xil' });
    const b = await createUser(h, ['CUSTOMER'], { firstName: 'Bir Xil' });
    const rows = await h.db.user.findMany({ where: { id: { in: [a.id, b.id] } }, select: { id: true, accountNumber: true } });
    const [first, second] = [a, b].map((u) => rows.find((r) => r.id === u.id)!.accountNumber);
    expect(first).toBeGreaterThanOrEqual(571);
    expect(second).toBeGreaterThan(first);
    await expect(h.db.user.update({ where: { id: a.id }, data: { accountNumber: 1 } })).rejects.toThrow();
    const me = await h.get('/users/me', a.token);
    expect(me.data.accountNumber).toBe(first);
  });
});

describe('PATCH /users/me/name', () => {
  it('saves a trimmed first and last name, and refuses blank or missing ones', async () => {
    const user = await createUser(h, ['CUSTOMER']);
    expect((await h.patch('/users/me/name', user.token, { firstName: 'Ali' })).status).toBe(400);
    expect((await h.patch('/users/me/name', user.token, { firstName: '  ', lastName: 'Valiyev' })).status).toBe(400);
    const res = await h.patch('/users/me/name', user.token, { firstName: '  Ali ', lastName: ' Valiyev ' });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ firstName: 'Ali', lastName: 'Valiyev' });
    expect((await h.patch('/users/me/name', undefined, { firstName: 'A', lastName: 'B' })).status).toBe(401);
  });
});
