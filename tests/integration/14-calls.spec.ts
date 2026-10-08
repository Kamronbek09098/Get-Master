import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { TelegramAlertService } from '../../src/infrastructure/telegram/telegram-alert.service';
import { CallService } from '../../src/modules/call/call.service';
import { bootHarness, createMaster, createUser, firstService, type Harness, type TestMaster, type TestUser, waitFor } from '../helpers/harness';

interface SseEvent {
  event: string;
  data: any;
}

/** SSE oqimini ochadi va kelgan hodisalarni yig‘adi (fetch oqimi). */
async function openStream(h: Harness, token: string, panel?: string) {
  const controller = new AbortController();
  const events: SseEvent[] = [];
  const response = await fetch(`${h.baseUrl}/api/v1/calls/events`, {
    headers: { cookie: `accessToken=${token}`, ...(panel ? { 'x-app-panel': panel } : {}), accept: 'text/event-stream' },
    signal: controller.signal,
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/event-stream');
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  void (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const event = /^event: (.+)$/m.exec(chunk)?.[1];
          const data = /^data: (.+)$/m.exec(chunk)?.[1];
          if (event && data) events.push({ event, data: JSON.parse(data) });
        }
      }
    } catch {
      /* uzildi */
    }
  })();
  return {
    events,
    next: (name: string, from = 0) => waitFor(async () => events.slice(from).find((item) => item.event === name), { label: `sse ${name}` }),
    close: () => controller.abort(),
  };
}

let h: Harness;
let customer: TestUser;
let master: TestMaster;
let conversationId: string;
let ipSeq = 0;
const ip = () => `10.14.0.${++ipSeq}`;
const call = (method: string, path: string, token: string, body?: unknown) => h.api(method, `/calls${path}`, { token, body, ip: ip() });

beforeAll(async () => {
  process.env.STUN_URLS = 'stun:stun.test:3478';
  process.env.TURN_URLS = 'turn:turn.test:3478?transport=udp,turns:turn.test:5349';
  process.env.TURN_SECRET = 'turn-test-secret';
  process.env.RATE_LIMIT_CALL_MAX = '100';
  h = await bootHarness();
  const service = await firstService(h);
  customer = await createUser(h);
  master = await createMaster(h, service.id);
  const opened = await h.api('POST', '/conversations/direct', { token: customer.token, body: { masterId: master.masterId }, ip: ip() });
  expect(opened.status).toBe(201);
  conversationId = opened.data.id;
});
afterAll(async () => {
  await h.close();
  delete process.env.STUN_URLS;
  delete process.env.TURN_URLS;
  delete process.env.TURN_SECRET;
  delete process.env.RATE_LIMIT_CALL_MAX;
});

async function resetCalls() {
  await h.db.call.updateMany({ where: { status: { in: ['RINGING', 'ACTIVE'] } }, data: { status: 'ENDED', endedAt: new Date() } });
}

describe('calls: ICE servers', () => {
  it('returns STUN plus short-lived TURN credentials derived from the shared secret', async () => {
    const res = await call('GET', '/ice-servers', customer.token);
    expect(res.status).toBe(200);
    expect(res.data.hasTurn).toBe(true);
    const [stun, turn] = res.data.iceServers;
    expect(stun.urls).toEqual(['stun:stun.test:3478']);
    expect(turn.urls).toEqual(['turn:turn.test:3478?transport=udp', 'turns:turn.test:5349']);
    expect(turn.username).toMatch(new RegExp(`^\\d+:${customer.id}$`));
    expect(turn.credential).toBe(createHmac('sha1', 'turn-test-secret').update(turn.username).digest('base64'));
    expect(Number(turn.username.split(':')[0])).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

describe('calls: lifecycle over SSE', () => {
  it('rings the callee, accepts, relays signals both ways and ends with a chat log entry', async () => {
    await resetCalls();
    const callerStream = await openStream(h, customer.token);
    const calleeStream = await openStream(h, master.token);
    try {
      const started = await call('POST', '', customer.token, { conversationId, mode: 'VIDEO' });
      expect(started.status).toBe(201);
      expect(started.data.calleeOnline).toBe(true);
      expect(started.data.call.status).toBe('RINGING');
      const callId: string = started.data.call.id;

      const incoming = await calleeStream.next('call.incoming');
      expect(incoming.data.call.id).toBe(callId);
      expect(incoming.data.call.mode).toBe('VIDEO');
      expect(incoming.data.from.id).toBe(customer.id);

      expect((await call('POST', `/${callId}/accept`, master.token)).status).toBe(201);
      await callerStream.next('call.accepted');

      // Signallar ikki tomonga: caller → offer, callee → answer + candidate.
      expect((await call('POST', `/${callId}/signal`, customer.token, { kind: 'offer', payload: { sdp: 'v=0 offer' } })).data.relayed).toBe(true);
      const offer = await calleeStream.next('call.signal');
      expect(offer.data).toMatchObject({ callId, kind: 'offer', payload: { sdp: 'v=0 offer' } });
      await call('POST', `/${callId}/signal`, master.token, { kind: 'answer', payload: { sdp: 'v=0 answer' } });
      const answer = await callerStream.next('call.signal');
      expect(answer.data).toMatchObject({ kind: 'answer', payload: { sdp: 'v=0 answer' } });

      expect((await call('POST', `/${callId}/ping`, customer.token)).data.alive).toBe(true);
      await h.db.call.update({ where: { id: callId }, data: { answeredAt: new Date(Date.now() - 65_000) } });
      const ended = await call('POST', `/${callId}/end`, customer.token);
      expect(ended.status).toBe(201);
      expect(ended.data.call.status).toBe('ENDED');
      const finalEvent = await calleeStream.next('call.ended');
      expect(finalEvent.data).toMatchObject({ callId, status: 'ENDED' });
      expect(finalEvent.data.seconds).toBeGreaterThanOrEqual(64);

      const log = await h.db.message.findFirst({ where: { conversationId, type: 'SYSTEM', text: { startsWith: 'call:' } }, orderBy: { createdAt: 'desc' } });
      expect(JSON.parse(log!.text!.slice(5))).toMatchObject({ callId, mode: 'VIDEO', status: 'ENDED' });

      // Ikkinchi marta tugatish xato emas: joriy holat qaytariladi.
      expect((await call('POST', `/${callId}/end`, master.token)).data.call.status).toBe('ENDED');
    } finally {
      callerStream.close();
      calleeStream.close();
    }
  });

  it('decline notifies the caller and logs a declined call', async () => {
    await resetCalls();
    const callerStream = await openStream(h, customer.token);
    const calleeStream = await openStream(h, master.token);
    try {
      const started = await call('POST', '', customer.token, { conversationId, mode: 'AUDIO' });
      const callId: string = started.data.call.id;
      await calleeStream.next('call.incoming');
      expect((await call('POST', `/${callId}/decline`, master.token)).data.call.status).toBe('DECLINED');
      const ended = await callerStream.next('call.ended');
      expect(ended.data).toMatchObject({ status: 'DECLINED', reason: 'declined' });
    } finally {
      callerStream.close();
      calleeStream.close();
    }
  });

  it('cancel by the caller leaves a missed-call notification for the callee', async () => {
    await resetCalls();
    const calleeStream = await openStream(h, master.token);
    try {
      const started = await call('POST', '', customer.token, { conversationId, mode: 'VIDEO' });
      expect(started.status, JSON.stringify(started.data)).toBe(201);
      const callId: string = started.data.call.id;
      await calleeStream.next('call.incoming');
      expect((await call('POST', `/${callId}/cancel`, customer.token)).data.call.status).toBe('CANCELED');
      await calleeStream.next('call.ended');
      const note = await waitFor(async () => h.db.notification.findFirst({ where: { userId: master.id, template: 'call.missed', data: { path: ['callId'], equals: callId } } }), { label: 'missed notification' });
      expect(note.title).toMatch(/o‘tkazib yuborilgan/i);
    } finally {
      calleeStream.close();
    }
  });

  it('an offline callee: the call is recorded as missed at once and the caller is told', async () => {
    await resetCalls();
    const started = await call('POST', '', customer.token, { conversationId, mode: 'AUDIO' });
    expect(started.status).toBe(201);
    expect(started.data.calleeOnline).toBe(false);
    expect(started.data.call.status).toBe('MISSED');
    // Hech narsa jiringlab qolmadi.
    expect(await h.db.call.count({ where: { status: { in: ['RINGING', 'ACTIVE'] } } })).toBe(0);
  });

  it('ringing for too long becomes missed (sweeper)', async () => {
    await resetCalls();
    const calleeStream = await openStream(h, master.token);
    try {
      const started = await call('POST', '', customer.token, { conversationId, mode: 'AUDIO' });
      const callId: string = started.data.call.id;
      await calleeStream.next('call.incoming');
      await h.db.call.update({ where: { id: callId }, data: { createdAt: new Date(Date.now() - 120_000) } });
      await h.app.get(CallService).sweep();
      expect((await h.db.call.findUniqueOrThrow({ where: { id: callId } })).status).toBe('MISSED');
      await calleeStream.next('call.ended');
    } finally {
      calleeStream.close();
    }
  });

  it('current() restores a ringing call after the page reloads (replayed on connect)', async () => {
    await resetCalls();
    const first = await openStream(h, master.token);
    const started = await call('POST', '', customer.token, { conversationId, mode: 'VIDEO' });
    const callId: string = started.data.call.id;
    await first.next('call.incoming');
    first.close();
    const second = await openStream(h, master.token);
    try {
      const replay = await second.next('call.current');
      expect(replay.data.call.id).toBe(callId);
      expect(replay.data.peer.id).toBe(customer.id);
    } finally {
      second.close();
      await call('POST', `/${callId}/cancel`, customer.token);
    }
  });
});

describe('calls: rules and access', () => {
  it('only one live call at a time (busy), the callee cannot be called while on another call', async () => {
    await resetCalls();
    const stream = await openStream(h, master.token);
    try {
      const first = await call('POST', '', customer.token, { conversationId, mode: 'AUDIO' });
      expect(first.status).toBe(201);
      await stream.next('call.incoming');
      const again = await call('POST', '', customer.token, { conversationId, mode: 'VIDEO' });
      expect(again.status).toBe(409);
      const reverse = await call('POST', '', master.token, { conversationId, mode: 'VIDEO' });
      expect(reverse.status).toBe(409);
      await call('POST', `/${first.data.call.id}/cancel`, customer.token);
    } finally {
      stream.close();
    }
  });

  it('strangers cannot start, accept, signal or end someone else’s call', async () => {
    await resetCalls();
    const stranger = await createUser(h);
    expect((await call('POST', '', stranger.token, { conversationId, mode: 'AUDIO' })).status).toBe(403);
    const stream = await openStream(h, master.token);
    try {
      const started = await call('POST', '', customer.token, { conversationId, mode: 'AUDIO' });
      const callId: string = started.data.call.id;
      await stream.next('call.incoming');
      expect((await call('POST', `/${callId}/accept`, stranger.token)).status).toBe(404);
      expect((await call('POST', `/${callId}/signal`, stranger.token, { kind: 'offer', payload: { x: 1 } })).status).toBe(404);
      expect((await call('POST', `/${callId}/end`, stranger.token)).status).toBe(404);
      // Chaqiruvchi o‘z qo‘ng‘irog‘ini qabul qila olmaydi.
      expect((await call('POST', `/${callId}/accept`, customer.token)).status).toBe(403);
      // Chaqirilgan tomon bekor qila olmaydi (u rad etadi).
      expect((await call('POST', `/${callId}/cancel`, master.token)).status).toBe(403);
      await call('POST', `/${callId}/cancel`, customer.token);
    } finally {
      stream.close();
    }
  });

  it('validates the signal payload', async () => {
    await resetCalls();
    const stream = await openStream(h, master.token);
    try {
      const started = await call('POST', '', customer.token, { conversationId, mode: 'AUDIO' });
      const callId: string = started.data.call.id;
      await stream.next('call.incoming');
      expect((await call('POST', `/${callId}/signal`, customer.token, { kind: 'hack', payload: {} })).status).toBe(400);
      expect((await call('POST', `/${callId}/signal`, customer.token, { kind: 'offer' })).status).toBe(400);
      const big = { sdp: 'x'.repeat(30_000) };
      expect((await call('POST', `/${callId}/signal`, customer.token, { kind: 'offer', payload: big })).status).toBe(400);
      await call('POST', `/${callId}/cancel`, customer.token);
    } finally {
      stream.close();
    }
  });

  it('support (admin) conversations and bad modes are refused; unauthenticated stream is 401', async () => {
    expect((await h.api('GET', '/calls/events', { ip: ip() })).status).toBe(401);
    expect((await call('POST', '', customer.token, { conversationId, mode: 'HOLOGRAM' })).status).toBe(400);
    expect((await call('POST', '', customer.token, { conversationId: '00000000-0000-4000-8000-00000000dead', mode: 'AUDIO' })).status).toBe(404);
  });

  it('forwards participant recordings to Telegram and never stores them', async () => {
    await resetCalls();
    const telegram = h.app.get(TelegramAlertService);
    const sent: { kind: string; size: number; caption: string; fileBase: string }[] = [];
    const spy = vi.spyOn(telegram, 'sendCallRecording').mockImplementation(async (input) => {
      sent.push({ kind: input.kind, size: input.data.length, caption: input.caption, fileBase: input.fileBase });
      return true;
    });
    const stream = await openStream(h, master.token);
    try {
      const started = await call('POST', '', customer.token, { conversationId, mode: 'VIDEO' });
      expect(started.status, JSON.stringify(started.data)).toBe(201);
      const callId: string = started.data.call.id;
      await stream.next('call.incoming');
      const upload = (token: string, body: Buffer, type = 'video/webm', part?: number) =>
        fetch(`${h.baseUrl}/api/v1/calls/${callId}/recording${part ? `?part=${part}` : ''}`, { method: 'POST', headers: { cookie: `accessToken=${token}`, 'content-type': type, 'x-forwarded-for': ip() }, body: new Uint8Array(body) });
      expect((await upload(customer.token, Buffer.alloc(2048, 1))).status).toBe(400); // hali javob berilmagan
      expect((await call('POST', `/${callId}/accept`, master.token)).status).toBe(201);
      await call('POST', `/${callId}/end`, customer.token);
      const mine = await upload(customer.token, Buffer.alloc(4096, 7));
      expect(mine.status).toBe(201);
      expect((await mine.json()).data.delivered).toBe(true);
      expect((await upload(master.token, Buffer.alloc(3000, 9), 'video/webm', 2)).status).toBe(201);
      expect((await upload(customer.token, Buffer.alloc(4096, 7), 'text/html')).status).toBe(400);
      expect((await upload(customer.token, Buffer.alloc(10, 7))).status).toBe(400);
      const outsider = await createUser(h);
      expect((await upload(outsider.token, Buffer.alloc(4096, 7))).status).toBe(404);
      expect(sent).toHaveLength(2);
      expect(sent.every((item) => item.kind === 'VIDEO')).toBe(true);
      expect(sent[0].size).toBe(4096);
      expect(sent[0].caption).toContain(callId);
      const lines = sent[0].caption.split('\n');
      expect(lines[0]).toBe('🎥  Video qo‘ng‘iroq yozuvi');
      expect(lines[1]).toMatch(/^<b>Yozuv egasi:<\/b> Mijoz .+ ID \d+  \(\+\d+\)$/);
      expect(lines[2]).toMatch(/^<b>Suhbatdosh:<\/b> Usta .+ ID \d+  \(\+\d+\)$/);
      expect(lines[3]).toBe('');
      expect(lines[4]).toMatch(/^<b>Boshlangan:<\/b> \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC · <b>Davomiyligi:<\/b> \d+:\d{2}$/);
      expect(lines[5]).toBe(`<b>Qo‘ng‘iroq:</b> ${callId}`);
      expect(lines[6]).toBe('');
      expect(lines[7]).toBe('<b>Bo‘lak:</b> 1');
      expect(sent[0].fileBase).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-1$/);
      expect(sent[1].fileBase).toMatch(/-2$/);
      // Tizimda yozuv jadvali ham, ombordagi fayllar ham yo‘q.
      const tables = await h.db.$queryRawUnsafe<{ table_name: string }[]>(`SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%recording%'`);
      expect(tables).toEqual([]);
    } finally {
      spy.mockRestore();
      stream.close();
    }
  });
});
