import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createAdmin, createSuperAdmin, createUser, type Harness, type TestUser } from '../helpers/harness';
import { hashSecret } from '../../src/common/security/hash';

let h: Harness;
let superAdmin: TestUser;
let admin: TestUser;
let customer: TestUser;
const PASSWORD = 'Eski-parol-123';

beforeAll(async () => {
  h = await bootHarness();
  superAdmin = await createSuperAdmin(h);
  admin = await createAdmin(h, ['USERS']);
  customer = await createUser(h, ['CUSTOMER']);
  await h.db.user.update({ where: { id: admin.id }, data: { passwordHash: await hashSecret(PASSWORD, 4), createdByAdminId: superAdmin.id } });
  await h.db.auditLog.createMany({ data: [{ actorId: admin.id, action: 'ADMIN_USER_SUSPENDED', targetType: 'User', targetId: customer.id, reason: 'test' }, { actorId: admin.id, action: 'AUTH_LOGIN_COMPLETED' }, { actorId: admin.id, action: 'AUTH_REFRESH_ROTATED' }] });
});
afterAll(async () => {
  await h.close();
});

describe('admin own profile', () => {
  it('is admin-only and returns the caller’s data, stats and recent activity (no technical entries)', async () => {
    expect((await h.get('/admin/me/profile', customer.token)).status).toBe(403);
    const res = await h.get('/admin/me/profile', admin.token);
    expect(res.status).toBe(200);
    expect(res.data.user).toEqual(expect.objectContaining({ id: admin.id, isSuperAdmin: false, hasPassword: true, adminPermissions: ['USERS'] }));
    expect(res.data.user.createdBy).toEqual(expect.objectContaining({ accountNumber: expect.any(Number) }));
    expect(res.data.user).not.toHaveProperty('passwordHash');
    expect(res.data.stats.actionsTotal).toBe(2);
    expect(res.data.stats.logins30d).toBe(1);
    expect(res.data.stats.activeDevices).toBeGreaterThanOrEqual(1);
    expect(res.data.activity.map((a: { action: string }) => a.action)).not.toContain('AUTH_REFRESH_ROTATED');
    const sup = await h.get('/admin/me/profile', superAdmin.token);
    expect(sup.data.stats.adminsCreated).toBeGreaterThanOrEqual(1);
  });

  it('changes the password only with the correct current one and audits it', async () => {
    const bad = await h.post('/users/me/password/change', admin.token, { currentPassword: 'noto-gri-parol', newPassword: 'Yangi-parol-456' });
    expect(bad.status).toBe(401);
    expect((await h.post('/users/me/password/change', admin.token, { currentPassword: PASSWORD, newPassword: PASSWORD })).status).toBe(400);
    expect((await h.post('/users/me/password/change', admin.token, { currentPassword: PASSWORD, newPassword: 'qisqa' })).status).toBe(400);
    const ok = await h.post('/users/me/password/change', admin.token, { currentPassword: PASSWORD, newPassword: 'Yangi-parol-456' });
    expect(ok.status).toBe(201);
    expect(ok.data.changed).toBe(true);
    expect(await h.db.auditLog.count({ where: { actorId: admin.id, action: 'USER_PASSWORD_CHANGED' } })).toBe(1);
    // eski parol endi ishlamaydi, yangisi ishlaydi
    expect((await h.post('/users/me/password/change', admin.token, { currentPassword: PASSWORD, newPassword: 'Boshqa-parol-789' })).status).toBe(401);
    expect((await h.post('/users/me/password/change', admin.token, { currentPassword: 'Yangi-parol-456', newPassword: 'Boshqa-parol-789' })).status).toBe(201);
    const profile = await h.get('/admin/me/profile', admin.token);
    expect(profile.data.stats.passwordChangedAt).toBeTruthy();
  });
});
