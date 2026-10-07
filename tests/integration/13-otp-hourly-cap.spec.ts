import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, type Harness, uniquePhone } from '../helpers/harness';

/** Soatiga ko‘pi bilan 3 ta kod: 4-so‘rov bloklanadi va necha daqiqadan keyin urinish mumkinligi aytiladi. */
const OVERRIDES = { OTP_MAX_REQUESTS: '3', OTP_WINDOW_SECONDS: '3600', OTP_RESEND_SECONDS: '5', RATE_LIMIT_OTP_REQUEST_MAX: '10' };
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

describe('OTP hourly cap (3 codes per hour)', () => {
  it('allows three codes within an hour and blocks the fourth with a wait time in minutes', async () => {
    const phone = uniquePhone();
    let ipSeq = 0;
    const ask = () => h.api('POST', '/otp/request', { ip: `10.13.0.${++ipSeq}`, body: { phone } });
    for (let n = 1; n <= 3; n += 1) {
      const res = await ask();
      expect(res.status, `request #${n}`).toBe(201);
      // Qayta yuborish kutish vaqtidan (5 s) o‘tkazib yuborish — faqat soatlik chegara tekshiriladi.
      await h.db.otpCode.updateMany({ where: { phone }, data: { createdAt: new Date(Date.now() - (4 - n) * 600_000) } });
    }
    const fourth = await ask();
    expect(fourth.status).toBe(429);
    expect(fourth.body.message).toMatch(/Soatiga 3 martadan ortiq kod so‘rab bo‘lmaydi/);
    expect(fourth.body.message).toMatch(/\d+ daqiqadan so‘ng/);
  });

  it('after the window passes, a new code can be requested again', async () => {
    const phone = uniquePhone();
    let ipSeq = 20;
    const ask = () => h.api('POST', '/otp/request', { ip: `10.13.0.${++ipSeq}`, body: { phone } });
    for (let n = 0; n < 3; n += 1) {
      expect((await ask()).status).toBe(201);
      await h.db.otpCode.updateMany({ where: { phone }, data: { createdAt: new Date(Date.now() - 20_000) } });
    }
    expect((await ask()).status).toBe(429);
    await h.db.otpCode.updateMany({ where: { phone }, data: { createdAt: new Date(Date.now() - 3_700_000) } });
    expect((await ask()).status).toBe(201);
  });

  it('requesting a new code fully expires the previous one (the old code stops working)', async () => {
    const phone = uniquePhone();
    const first = await h.api('POST', '/otp/request', { ip: '10.13.0.60', body: { phone } });
    expect(first.status).toBe(201);
    const oldCode: string = first.data.developmentCode;
    await h.db.otpCode.updateMany({ where: { phone }, data: { createdAt: new Date(Date.now() - 20_000) } });
    const second = await h.api('POST', '/otp/request', { ip: '10.13.0.61', body: { phone } });
    expect(second.status).toBe(201);
    const newCode: string = second.data.developmentCode;
    expect(await h.db.otpCode.count({ where: { phone, status: 'ACTIVE' } })).toBe(1);
    const stale = await h.api('POST', '/otp/verify', { ip: '10.13.0.62', body: { phone, code: oldCode } });
    expect(stale.status).toBe(400);
    const fresh = await h.api('POST', '/otp/verify', { ip: '10.13.0.63', body: { phone, code: newCode } });
    expect(fresh.status).toBe(201);
  });
});
