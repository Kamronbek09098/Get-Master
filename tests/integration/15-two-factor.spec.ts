import * as bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createAdmin, createUser, type Harness } from '../helpers/harness';

const PASSWORD = 'Correct-Horse-9';
let h: Harness;

beforeAll(async () => {
  h = await bootHarness();
});
afterAll(async () => {
  await h.close();
});

async function userWithPassword(roles: Array<'CUSTOMER' | 'MASTER' | 'ADMIN'> = ['CUSTOMER']) {
  const user = roles.includes('ADMIN') ? await createAdmin(h) : await createUser(h, roles);
  await h.db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(PASSWORD, 4) } });
  return user;
}
const setTwoFactor = (token: string, body: unknown) => h.patch('/users/me/two-factor', token, body);
const login = (phone: string, ip: string) => h.api('POST', '/auth/login', { ip, body: { phone, password: PASSWORD } });

describe('two-factor authentication toggle', () => {
  it('is on by default: login asks for an OTP', async () => {
    const user = await userWithPassword();
    expect((await h.get('/users/me', user.token)).data.twoFactorEnabled).toBe(true);
    const res = await login(user.phone, '10.15.0.1');
    expect(res.status).toBe(201);
    expect(res.data.verificationRequired).toBe(true);
  });

  it('turning it off needs the current password', async () => {
    const user = await userWithPassword();
    expect((await setTwoFactor(user.token, { enabled: false })).status).toBe(400);
    expect((await setTwoFactor(user.token, { enabled: false, password: 'Wrong-Pass-123' })).status).toBe(401);
    const ok = await setTwoFactor(user.token, { enabled: false, password: PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.data.twoFactorEnabled).toBe(false);
    expect(await h.db.auditLog.count({ where: { targetId: user.id, action: 'USER_TWO_FACTOR_DISABLED' } })).toBe(1);
  });

  it('when off: password alone signs in (no OTP, session cookies issued); when on again: OTP is required', async () => {
    const user = await userWithPassword();
    await setTwoFactor(user.token, { enabled: false, password: PASSWORD });

    const off = await login(user.phone, '10.15.0.2');
    expect(off.status).toBe(201);
    expect(off.data.verificationRequired).toBe(false);
    expect(off.headers.getSetCookie().join(';')).toMatch(/accessToken=/);
    expect(await h.db.otpCode.count({ where: { phone: user.phone, purpose: 'LOGIN' } })).toBe(0);

    expect((await setTwoFactor(user.token, { enabled: true })).data.twoFactorEnabled).toBe(true);
    const on = await login(user.phone, '10.15.0.3');
    expect(on.data.verificationRequired).toBe(true);
  });

  it('a wrong password never signs in, even with two-factor off', async () => {
    const user = await userWithPassword();
    await setTwoFactor(user.token, { enabled: false, password: PASSWORD });
    const res = await h.api('POST', '/auth/login', { ip: '10.15.0.4', body: { phone: user.phone, password: 'Wrong-Pass-123' } });
    expect(res.status).toBe(401);
  });

  it('administrators cannot turn it off', async () => {
    const admin = await userWithPassword(['ADMIN']);
    expect((await setTwoFactor(admin.token, { enabled: false, password: PASSWORD })).status).toBe(403);
    expect((await login(admin.phone, '10.15.0.5')).data.verificationRequired).toBe(true);
  });

  it('requires authentication', async () => {
    expect((await h.patch('/users/me/two-factor', undefined, { enabled: true })).status).toBe(401);
  });
});
