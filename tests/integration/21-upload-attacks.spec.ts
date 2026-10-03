import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookOrder, bootHarness, createMaster, createUser, firstService, uploadImage, type Harness, type TestUser } from '../helpers/harness';

let h: Harness;
let alice: TestUser;
let mallory: TestUser;
let conversationId: string;

beforeAll(async () => {
  h = await bootHarness();
  alice = await createUser(h);
  mallory = await createUser(h);
  const service = await firstService(h);
  const master = await createMaster(h, service.id);
  const order = await bookOrder(h, alice, master, service.id);
  conversationId = (await h.db.conversation.findUniqueOrThrow({ where: { orderId: order.orderId } })).id;
});
afterAll(async () => {
  await h.close();
});

const upload = async (token: string, bytes: Uint8Array, name: string, type: string) => {
  const form = new FormData();
  form.set('kind', 'MESSAGE_ATTACHMENT');
  form.set('linkType', 'Conversation');
  form.set('linkId', conversationId);
  form.set('file', new Blob([new Uint8Array(bytes)], { type }), name);
  return h.api('POST', '/media/uploads', { token, form });
};
const text = (value: string) => new TextEncoder().encode(value);

describe('upload attacks', () => {
  it('rejects scripts, HTML and SVG even when disguised with an image name/type', async () => {
    const payloads: Array<[string, string, Uint8Array]> = [
      ['x.png', 'image/png', text('<html><script>alert(document.cookie)</script></html>')],
      ['x.svg', 'image/svg+xml', text('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>')],
      ['shell.php.png', 'image/png', text('<?php system($_GET["c"]); ?>')],
      ['x.jpg', 'image/jpeg', text('#!/bin/sh\nrm -rf /')],
      ['x.pdf', 'application/pdf', text('MZ\x90\x00 not really a pdf')],
      ['empty.png', 'image/png', new Uint8Array(0)],
    ];
    for (const [name, type, bytes] of payloads) {
      const res = await upload(alice.token, bytes, name, type);
      if (res.status < 300) {
        // Qabul qilingan bo‘lsa ham fayl READY bo‘lmasligi (rad etilishi) kerak.
        await new Promise((r) => setTimeout(r, 1500));
        const asset = await h.db.mediaAsset.findUnique({ where: { id: res.data.id } });
        expect(asset?.status).not.toBe('READY');
      } else {
        expect([400, 413, 415, 422]).toContain(res.status);
      }
    }
  });

  it('path-traversal file names never reach the storage key or the response headers', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const res = await upload(alice.token, png, '../../../etc/passwd\r\nSet-Cookie: x=1.png', 'image/png');
    if (res.status < 300) {
      const asset = await h.db.mediaAsset.findUniqueOrThrow({ where: { id: res.data.id } });
      for (const key of [asset.quarantineKey, asset.originalKey]) expect(key ?? '').not.toContain('..');
      expect(JSON.stringify(res.headers)).not.toMatch(/set-cookie.*x=1/i);
    } else {
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });

  it('a stranger cannot attach to someone else’s conversation or read its files', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    expect((await upload(mallory.token, png, 'x.png', 'image/png')).status).toBe(403);
    const id = await uploadImage(h, alice.token, 'MESSAGE_ATTACHMENT', 'Conversation', conversationId, 80);
    expect((await h.get(`/media/${id}/original`, mallory.token)).status).toBeGreaterThanOrEqual(403);
    const own = await h.get(`/media/${id}/original`, alice.token);
    expect(own.status).toBe(200);
    expect((await h.get(`/media/${id}/original`)).status).toBe(401);
  });

  it('signed file links are tamper-proof and the stream carries a sandboxing CSP', async () => {
    const id = await uploadImage(h, alice.token, 'MESSAGE_ATTACHMENT', 'Conversation', conversationId, 90);
    const signed = (await h.get(`/media/${id}/original`, alice.token)).data.url as string;
    const url = new URL(signed);
    const path = url.pathname.replace(/^\/api\/v1/, '') + url.search;
    const ok = await h.api('GET', path);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-security-policy')).toContain('sandbox');
    expect(ok.headers.get('x-content-type-options')).toBe('nosniff');
    const sig = url.searchParams.get('sig') ?? '';
    const flipped = path.replace(sig, sig.slice(0, -1) + (sig.endsWith('a') ? 'b' : 'a'));
    expect((await h.api('GET', flipped)).status).toBe(404);
    const longer = path.replace(/expires=\d+/, `expires=${Math.floor(Date.now() / 1000) + 10_000_000}`);
    expect((await h.api('GET', longer)).status).toBe(404);
    const expired = path.replace(/expires=\d+/, 'expires=1');
    expect((await h.api('GET', expired)).status).toBe(404);
  });
});
