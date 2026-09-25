import net from 'node:net';
import { createTransport } from 'nodemailer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MailProvider } from '../../src/infrastructure/mail/mail.provider';
import { OtpService } from '../../src/modules/otp/otp.service';
import { bootHarness, createUser, type Harness, uniquePhone, waitFor } from '../helpers/harness';

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
          if (line === '.') {
            inData = false;
            messages.push(current);
            current = { to: '', data: '' };
            reply('250 OK');
          } else current.data += `${line}\n`;
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

let sink: Awaited<ReturnType<typeof startSmtpSink>>;
let h: Harness;

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

describe('OTP → MailService → MailProvider (nodemailer) → SMTP', () => {
  it('delivers the exact issued code to the account e-mail over real SMTP', async () => {
    const user = await createUser(h);
    const email = `otp-${user.id.slice(0, 8)}@example.test`;
    await h.db.user.update({ where: { id: user.id }, data: { email } });

    const res = await h.api('POST', '/otp/request', { ip: '10.7.0.1', body: { phone: user.phone } });
    expect(res.status).toBe(201);
    const code: string = res.data.developmentCode;
    const mail = await waitFor(async () => sink.messages.find((m) => m.to === email), { label: 'mail at SMTP sink' });
    expect(mail.data).toContain(`kodingiz: ${code}`);
    expect(mail.data).toMatch(/Subject: GetMaster tasdiqlash kodi/);
    expect(mail.data).toMatch(/From: no-reply@getmaster\.test/);
    expect((await h.api('POST', '/otp/verify', { ip: '10.7.0.1', body: { phone: user.phone, code } })).data).toEqual({ verified: true });
  });

  it('the code reaches only the mailbox: with dev-echo off the API response carries no code', async () => {
    const user = await createUser(h);
    const email = `quiet-${user.id.slice(0, 8)}@example.test`;
    await h.db.user.update({ where: { id: user.id }, data: { email } });
    process.env.OTP_DEV_ECHO = 'false';
    try {
      const res = await h.api('POST', '/otp/request', { ip: '10.7.0.2', body: { phone: user.phone } });
      expect(JSON.stringify(res.body)).not.toMatch(/\b\d{6}\b/);
      const mail = await waitFor(async () => sink.messages.find((m) => m.to === email), { label: 'mail' });
      expect(mail.data).toMatch(/kodingiz: \d{6}/);
    } finally {
      process.env.OTP_DEV_ECHO = 'true';
    }
  });

  it('an account without an e-mail address sends nothing (no SMS transport exists) but the request still succeeds', async () => {
    const user = await createUser(h);
    const before = sink.messages.length;
    const res = await h.api('POST', '/otp/request', { ip: '10.7.0.3', body: { phone: user.phone } });
    expect(res.status).toBe(201);
    await new Promise((r) => setTimeout(r, 500));
    expect(sink.messages.length).toBe(before);
  });

  it('login/registration codes are mailed too, for the correct purpose', async () => {
    const user = await createUser(h);
    const email = `login-${user.id.slice(0, 8)}@example.test`;
    await h.db.user.update({ where: { id: user.id }, data: { email, passwordHash: '$2a$04$abcdefghijklmnopqrstuuFN0kU1r0dO1c0VqmY1gX7pI2nQ8n9yG' } });
    await h.app.get(OtpService).issue(user.phone, 'LOGIN', user.id);
    const mail = await waitFor(async () => sink.messages.find((m) => m.to === email), { label: 'login mail' });
    expect(mail.data).toContain('tizimga kirish');
  });
});

describe('SMTP failure handling', () => {
  it('an unreachable SMTP server never fails or hangs the OTP request, and leaks nothing', async () => {
    const dead = await startSmtpSink();
    const deadPort = dead.port;
    await dead.close();
    const provider = h.app.get(MailProvider) as any;
    const original = provider.transporter;
    provider.transporter = createTransport({ host: '127.0.0.1', port: deadPort, connectionTimeout: 1500 });
    try {
      const user = await createUser(h);
      await h.db.user.update({ where: { id: user.id }, data: { email: `down-${user.id.slice(0, 8)}@example.test` } });
      const started = Date.now();
      const res = await h.api('POST', '/otp/request', { ip: '10.7.0.4', body: { phone: user.phone } });
      expect(res.status).toBe(201);
      expect(Date.now() - started).toBeLessThan(10_000);
      expect(await h.db.otpCode.count({ where: { phone: user.phone, status: 'ACTIVE' } })).toBe(1);
    } finally {
      provider.transporter = original;
    }
  });
});

void uniquePhone;
