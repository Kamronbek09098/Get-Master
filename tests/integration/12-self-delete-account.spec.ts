import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookOrder, bootHarness, createAdmin, createMaster, createUser, firstService, type Harness } from '../helpers/harness';

const PASSWORD = 'Str0ng-Passw0rd!';
let h: Harness;
let ipSeq = 0;
const nextIp = () => `10.12.0.${++ipSeq}`;

beforeAll(async () => {
  h = await bootHarness();
});
afterAll(async () => {
  await h.close();
});

async function withPassword(userId: string) {
  await h.db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(PASSWORD, 4), email: `del-${userId.slice(0, 8)}@example.test` } });
}

describe('POST /users/me/delete-account', () => {
  it('needs the current password; a wrong one is rejected and nothing changes', async () => {
    const user = await createUser(h);
    await withPassword(user.id);
    const missing = await h.api('POST', '/users/me/delete-account', { token: user.token, ip: nextIp(), body: {} });
    expect(missing.status).toBe(400);
    const wrong = await h.api('POST', '/users/me/delete-account', { token: user.token, ip: nextIp(), body: { password: 'nope-nope-nope' } });
    expect(wrong.status).toBe(401);
    expect((await h.db.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe('ACTIVE');
  });

  it('soft-deletes: frees phone and email, revokes sessions, cancels open requests, audits', async () => {
    const user = await createUser(h);
    await withPassword(user.id);
    const before = await h.db.user.findUniqueOrThrow({ where: { id: user.id } });
    const res = await h.api('POST', '/users/me/delete-account', { token: user.token, ip: nextIp(), body: { password: PASSWORD } });
    expect(res.status).toBe(201);
    expect(res.data).toEqual({ deleted: true });
    const after = await h.db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.status).toBe('DELETED');
    expect(after.deletedAt).not.toBeNull();
    expect(after.phone).toBe(`del${before.accountNumber}_${before.phone}`.slice(0, 32));
    expect(after.email).toBeNull();
    expect(after.passwordHash).toBeNull();
    expect(await h.db.deviceSession.count({ where: { userId: user.id, status: 'ACTIVE' } })).toBe(0);
    expect(await h.db.auditLog.count({ where: { actorId: user.id, action: 'USER_SELF_DELETED' } })).toBe(1);
    // Eski raqam bilan kirish endi mumkin emas.
    const login = await h.api('POST', '/auth/login', { ip: nextIp(), body: { phone: before.phone, password: PASSWORD } });
    expect(login.status).toBe(401);
  });

  it('is refused while an order is in progress (as customer)', async () => {
    const customer = await createUser(h);
    await withPassword(customer.id);
    const service = await firstService(h);
    const master = await createMaster(h, service.id);
    await bookOrder(h, customer, master, service.id);
    const res = await h.api('POST', '/users/me/delete-account', { token: customer.token, ip: nextIp(), body: { password: PASSWORD } });
    expect(res.status).toBe(409);
    expect((await h.db.user.findUniqueOrThrow({ where: { id: customer.id } })).status).toBe('ACTIVE');
  });

  it('administrators cannot delete themselves this way', async () => {
    const admin = await createAdmin(h);
    await withPassword(admin.id);
    const res = await h.api('POST', '/users/me/delete-account', { token: admin.token, ip: nextIp(), body: { password: PASSWORD } });
    expect(res.status).toBe(403);
  });
});
