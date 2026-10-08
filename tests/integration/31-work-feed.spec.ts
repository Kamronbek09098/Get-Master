import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createMaster, createUser, firstService, uploadImage, type Harness, type TestMaster, type TestUser } from '../helpers/harness';

let h: Harness;
let master: TestMaster;
let other: TestMaster;
let customer: TestUser;
let beforeId: string;
let afterId: string;
let postId: string;
const tag = `lenta${Date.now() % 100000}`;

beforeAll(async () => {
  h = await bootHarness();
  const service = await firstService(h);
  master = await createMaster(h, service.id, { firstName: 'Lenta' });
  other = await createMaster(h, service.id, { firstName: 'Boshqa' });
  customer = await createUser(h);
  beforeId = await uploadImage(h, master.token, 'MASTER_PORTFOLIO', 'MasterProfile', master.masterId, 70);
  afterId = await uploadImage(h, master.token, 'MASTER_PORTFOLIO', 'MasterProfile', master.masterId, 90);
}, 120_000);
afterAll(() => h.close());

describe('GET/POST /feed — professional ish lentasi', () => {
  it('only masters can publish and every asset must be their own, ready and of the right type', async () => {
    const body = { kind: 'BEFORE_AFTER', caption: 'Kran almashtirildi', tags: [`#${tag}`, 'Santexnika'], beforeAssetId: beforeId, afterAssetId: afterId };
    expect((await h.post('/feed', customer.token, body)).status).toBe(403);
    expect((await h.post('/feed', other.token, body)).status).toBe(400); // begona fayllar
    expect((await h.post('/feed', master.token, { kind: 'VIDEO' })).status).toBe(400); // video yo‘q
    expect((await h.post('/feed', master.token, { kind: 'VIDEO', videoAssetId: afterId })).status).toBe(400); // rasm video o‘rnida
    const created = await h.post('/feed', master.token, body);
    expect(created.status).toBe(201);
    postId = created.data.id;
  });

  it('shows the published post to customers with signed media links, creator card and viewer state', async () => {
    const list = await h.get('/feed?limit=30', customer.token);
    expect(list.status).toBe(200);
    const item = list.data.items.find((row: { id: string }) => row.id === postId);
    expect(item).toBeTruthy();
    expect(item.kind).toBe('BEFORE_AFTER');
    expect(item.tags).toEqual([tag, 'santexnika']);
    expect(item.media.beforeUrl).toContain('/media/file/');
    expect(item.media.afterUrl).toContain('/media/file/');
    expect(item.master).toMatchObject({ id: master.masterId, verified: true });
    expect(item.viewer).toEqual({ liked: false, saved: false, following: false, own: false });
    // Fayl kirgan foydalanuvchiga ochiq (imzolangan havola).
    expect((await h.get(`/media/${afterId}/original`, customer.token)).status).toBe(200);
  });

  it('like / save / comment / share / view keep counters consistent and idempotent', async () => {
    expect((await h.api('PUT', `/feed/${postId}/like`, { token: customer.token })).data).toMatchObject({ liked: true, likeCount: 1 });
    expect((await h.api('PUT', `/feed/${postId}/like`, { token: customer.token })).data.likeCount).toBe(1);
    expect((await h.api('PUT', `/feed/${postId}/save`, { token: customer.token })).data).toMatchObject({ saved: true, saveCount: 1 });
    expect((await h.post(`/feed/${postId}/comments`, customer.token, { text: 'Juda yaxshi ish!' })).status).toBe(201);
    expect((await h.post(`/feed/${postId}/comments`, customer.token, { text: '   ' })).status).toBe(400);
    await h.post(`/feed/${postId}/share`, customer.token, {});
    await h.post(`/feed/${postId}/view`, customer.token, {});
    await h.post(`/feed/${postId}/view`, master.token, {}); // egasining ko‘rishi hisoblanmaydi
    const one = await h.get(`/feed/${postId}`, customer.token);
    expect(one.data.counts).toMatchObject({ likes: 1, saves: 1, comments: 1, shares: 1, views: 1 });
    expect(one.data.viewer).toMatchObject({ liked: true, saved: true });
    const comments = await h.get(`/feed/${postId}/comments`, customer.token);
    expect(comments.data.items[0].text).toBe('Juda yaxshi ish!');
    expect((await h.api('DELETE', `/feed/${postId}/like`, { token: customer.token })).data.likeCount).toBe(0);
  });

  it('tabs: following, saved, trend, plus category/search/master filters', async () => {
    const ids = async (path: string) => ((await h.get(path, customer.token)).data.items as Array<{ id: string }>).map((row) => row.id);
    expect(await ids('/feed?tab=following')).not.toContain(postId);
    expect((await h.api('PUT', `/feed/masters/${master.masterId}/follow`, { token: customer.token })).data).toMatchObject({ following: true, followers: 1 });
    expect(await ids('/feed?tab=following')).toContain(postId);
    expect(await ids('/feed?tab=saved')).toContain(postId);
    expect(await ids('/feed?tab=trend&limit=30')).toContain(postId);
    expect(await ids(`/feed?q=${tag}`)).toEqual([postId]);
    expect(await ids('/feed?q=umuman-mavjud-emas-xyz')).toEqual([]);
    expect(await ids(`/feed?master=${master.masterId}`)).toContain(postId);
    expect(await ids(`/feed?master=${other.masterId}`)).not.toContain(postId);
    expect((await h.api('PUT', `/feed/masters/${master.masterId}/follow`, { token: master.token })).status).toBe(400); // o‘zini kuzata olmaydi
    await h.api('DELETE', `/feed/masters/${master.masterId}/follow`, { token: customer.token });
    expect(await ids('/feed?tab=following')).not.toContain(postId);
  });

  it('hides posts of masters that are not active, lets only the owner delete, and cleans up media', async () => {
    await h.db.masterProfile.update({ where: { id: master.masterId }, data: { status: 'INACTIVE' } });
    expect((await h.get(`/feed/${postId}`, customer.token)).status).toBe(404);
    expect((await h.get(`/feed/${postId}`, master.token)).status).toBe(200); // egasi ko‘radi
    await h.db.masterProfile.update({ where: { id: master.masterId }, data: { status: 'ACTIVE' } });
    expect((await h.api('DELETE', `/feed/${postId}`, { token: other.token })).status).toBe(404);
    expect((await h.api('DELETE', `/feed/${postId}`, { token: master.token })).status).toBe(200);
    expect((await h.get(`/feed/${postId}`, customer.token)).status).toBe(404);
    expect(await h.db.mediaAsset.count({ where: { id: { in: [beforeId, afterId] } } })).toBe(0);
  });
});
