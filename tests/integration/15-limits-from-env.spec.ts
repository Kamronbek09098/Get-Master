import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RedisService } from '../../src/infrastructure/redis/redis.service';
import { bootHarness, type Harness, uniquePhone } from '../helpers/harness';

const OVERRIDES = {
  LOGIN_MAX_FAILURES: '2',
  LOGIN_LOCK_SECONDS: '30',
  LOGIN_FAILURE_WINDOW_SECONDS: '77',
  OTP_TTL_SECONDS: '90',
  OTP_RESEND_SECONDS: '7',
  OTP_MAX_REQUESTS: '2',
  RATE_LIMIT_REGISTER_MAX: '1',
  RATE_LIMIT_OTP_REQUEST_MAX: '2',
  REFRESH_TOKEN_TTL_MINUTES: '10',
};

const saved: Record<string, string | undefined> = {};
let h: Harness;

beforeAll(async () => {
  for (const [key, value] of Object.entries(OVERRIDES)) {
    saved[key] = process.env[key];
    process.env[key] = value;
  }
  h = await bootHarness();
});
afterAll(async () => {
  await h.close();
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('limits and timings come from the environment', () => {
  it('login lockout uses LOGIN_MAX_FAILURES / LOGIN_LOCK_SECONDS / LOGIN_FAILURE_WINDOW_SECONDS', async () => {
    const phone = uniquePhone();
    await h.db.user.create({
      data: { phone, status: 'ACTIVE', passwordHash: await bcrypt.hash('Str0ng-Passw0rd!', 4), userRoles: { create: { role: 'CUSTOMER' } } },
    });
    const ip = '10.30.0.1';
    const wrong = () => h.api('POST', '/auth/login', { ip, body: { phone, password: 'Nope-Nope-1' } });

    expect((await wrong()).status).toBe(401);
    const redis = h.app.get(RedisService);
    const windowTtl = await redis.ttl(`loginfail:${ip}:${phone}:any`);
    expect(windowTtl).toBeGreaterThan(70);
    expect(windowTtl).toBeLessThanOrEqual(77);

    expect((await wrong()).status).toBe(401);
    const locked = await wrong();
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('LOGIN_LOCKED');
    const lockTtl = await redis.ttl(`loginlock:${ip}:${phone}:any`);
    expect(lockTtl).toBeGreaterThan(25);
    expect(lockTtl).toBeLessThanOrEqual(30);
  });

  it('OTP timings and caps use OTP_* settings', async () => {
    const phone = uniquePhone();
    const ask = (ip: string) => h.api('POST', '/otp/request', { ip, body: { phone } });

    const first = await ask('10.30.0.2');
    expect(first.status).toBe(201);
    expect(first.data).toMatchObject({ expiresIn: 90, resendAfter: 7 });

    const tooSoon = await ask('10.30.0.3');
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.message).toMatch(/[1-7] soniya kuting/);

    await h.db.otpCode.updateMany({ where: { phone }, data: { createdAt: new Date(Date.now() - 10_000) } });
    expect((await ask('10.30.0.4')).status).toBe(201);
    await h.db.otpCode.updateMany({ where: { phone }, data: { createdAt: new Date(Date.now() - 20_000) } });
    const capped = await ask('10.30.0.5');
    expect(capped.status).toBe(429);
    expect(capped.body.message).toMatch(/daqiqadan so‘ng/);
  });

  it('endpoint rate limits use RATE_LIMIT_* (register: 1 per window)', async () => {
    const ip = '10.30.0.6';
    const register = () => h.api('POST', '/auth/register', { ip, body: { phone: uniquePhone(), password: 'Str0ng-Passw0rd!', firstName: 'Test', lastName: 'User', acceptedPolicyIds: [] } });
    expect((await register()).status).not.toBe(429);
    expect((await register()).status).toBe(429);
  });

  it('the refresh-token lifetime follows REFRESH_TOKEN_TTL_MINUTES', async () => {
    const config = h.app.get(ConfigService);
    expect(config.get('auth.refreshTtlSeconds')).toBe(600);
    expect(config.get('limits.otp.ttlSeconds')).toBe(90);
    expect(config.get('limits.rate.register')).toEqual({ limit: 1, windowSeconds: 3600 });
  });
});
