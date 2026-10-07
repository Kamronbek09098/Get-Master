import net from 'node:net';
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SmsService } from '../../src/infrastructure/sms/sms.service';
import { bootHarness, createUser, type Harness, waitFor } from '../helpers/harness';

/** Kirish kodi: standart — email (xabar bilan), SMS — foydalanuvchi so‘raganda (ulangan bo‘lsa). */
function startSmtpSink(): Promise<{ port: number; messages: Array<{ to: string; data: string }>; close(): Promise<void> }> {
  const messages: Array<{ to: string; data: string }> = [];
  const server = net.createServer((socket) => {
    let inData = false;
    let buffer = '';
    let current = { to: '', data: '' };
    const reply = (line: string) => socket.write(`${line}\r\n`);
    reply('220 sink ESMTP');
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      let idx: number;
      while ((idx = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (inData) {
          if (line === '.') { inData = false; messages.push(current); current = { to: '', data: '' }; reply('250 OK'); } else current.data += `${line}\n`;
          continue;
        }
        const upper = line.toUpperCase();
        if (upper.startsWith('EHLO') || upper.startsWith('HELO')) { reply('250-sink'); reply('250 OK'); }
        else if (upper.startsWith('RCPT TO')) { current.to = line.slice(line.indexOf('<') + 1, line.indexOf('>')); reply('250 OK'); }
        else if (upper.startsWith('DATA')) { inData = true; reply('354 go'); }
        else if (upper.startsWith('QUIT')) { reply('221 bye'); socket.end(); }
        else reply('250 OK');
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      resolve({ port, messages, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

const PASSWORD = 'Str0ng-Passw0rd!';
let sink: Awaited<ReturnType<typeof startSmtpSink>>;
let h: Harness;
let ipSeq = 0;
const nextIp = () => `10.11.0.${++ipSeq}`;

async function userWith(email: string | null) {
  const user = await createUser(h);
  await h.db.user.update({ where: { id: user.id }, data: { email, passwordHash: await bcrypt.hash(PASSWORD, 4), twoFactorEnabled: true } });
  return user;
}

beforeAll(async () => {
  sink = await startSmtpSink();
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = String(sink.port);
  process.env.SMTP_FROM = 'no-reply@getmaster.test';
  h = await bootHarness();
});
afterAll(async () => {
  await h.close();
  await sink.close();
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_FROM;
});

describe('login code delivery routes', () => {
  it('default: the code is emailed and the response says so (masked address), SMS not offered when unavailable', async () => {
    const user = await userWith(`route-${Date.now()}@example.test`);
    const res = await h.api('POST', '/auth/login', { ip: nextIp(), body: { phone: user.phone, password: PASSWORD } });
    expect(res.status).toBe(201);
    expect(res.data.delivery.channel).toBe('EMAIL');
    expect(res.data.delivery.destination).toMatch(/^.{2}•••@example\.test$/);
    expect(res.data.smsAvailable).toBe(false);
    await waitFor(async () => sink.messages.find((m) => m.data.includes(res.data.developmentCode ?? 'x') || m.to.startsWith('route-')), { label: 'login mail' });
  });

  it('asking for SMS while the SMS service is not connected is a clear 400 (no code is wasted)', async () => {
    const user = await userWith(`nosms-${Date.now()}@example.test`);
    const res = await h.api('POST', '/auth/login', { ip: nextIp(), body: { phone: user.phone, password: PASSWORD, codeChannel: 'SMS' } });
    expect(res.status).toBe(400);
    expect(await h.db.otpCode.count({ where: { phone: user.phone } })).toBe(0);
  });

  it('with SMS connected: the user can switch from the emailed code to SMS right away, once, and the code goes by SMS', async () => {
    const sms = h.app.get(SmsService);
    const sent: Array<{ phone: string; text: string }> = [];
    const original = { isEnabled: sms.isEnabled, send: sms.send };
    sms.isEnabled = () => true;
    sms.send = async (phone: string, text: string) => { sent.push({ phone, text }); };
    try {
      const user = await userWith(`both-${Date.now()}@example.test`);
      const first = await h.api('POST', '/auth/login', { ip: nextIp(), body: { phone: user.phone, password: PASSWORD } });
      expect(first.data.delivery.channel).toBe('EMAIL');
      expect(first.data.smsAvailable).toBe(true);

      const second = await h.api('POST', '/auth/login', { ip: nextIp(), body: { phone: user.phone, password: PASSWORD, codeChannel: 'SMS' } });
      expect(second.status).toBe(201);
      expect(second.data.delivery.channel).toBe('SMS');
      expect(second.data.delivery.destination).toContain('••');
      await waitFor(async () => sent.find((s) => s.phone === user.phone), { label: 'sms sent' });
      expect(sent[0]!.text).toMatch(/\b\d{6}\b/);

      // Ikkinchi marta darhol almashtirish — kutish talab qilinadi (suiiste’molga yo‘l qo‘yilmaydi).
      const third = await h.api('POST', '/auth/login', { ip: nextIp(), body: { phone: user.phone, password: PASSWORD, codeChannel: 'SMS' } });
      expect(third.status).toBe(429);
    } finally {
      sms.isEnabled = original.isEnabled;
      sms.send = original.send;
    }
  });

  it('an account without email goes to SMS by default when SMS is connected', async () => {
    const sms = h.app.get(SmsService);
    const original = { isEnabled: sms.isEnabled, send: sms.send };
    const sent: string[] = [];
    sms.isEnabled = () => true;
    sms.send = async (phone: string) => { sent.push(phone); };
    try {
      const user = await userWith(null);
      const res = await h.api('POST', '/auth/login', { ip: nextIp(), body: { phone: user.phone, password: PASSWORD } });
      expect(res.data.delivery.channel).toBe('SMS');
      await waitFor(async () => sent.find((p) => p === user.phone), { label: 'sms' });
    } finally {
      sms.isEnabled = original.isEnabled;
      sms.send = original.send;
    }
  });

  it('the public OTP request never reveals whether an email exists', async () => {
    const user = await userWith(`secret-${Date.now()}@example.test`);
    const res = await h.api('POST', '/otp/request', { ip: nextIp(), body: { phone: user.phone } });
    expect(res.data.delivery).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('example.test');
  });
});
