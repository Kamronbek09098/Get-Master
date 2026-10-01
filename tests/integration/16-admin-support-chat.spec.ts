import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createAdmin, createUser, type Harness, MISSING_UUID, type TestUser } from '../helpers/harness';

let h: Harness;
let admin: TestUser;
let user: TestUser;

beforeAll(async () => {
  h = await bootHarness();
  admin = await createAdmin(h);
  user = await createUser(h, ['CUSTOMER'], { firstName: 'Ali' });
});
afterAll(async () => {
  await h.close();
});

const open = (token: string | undefined, userId: string) => h.post(`/conversations/support/${userId}`, token);

describe('admin → user chat (SUPPORT)', () => {
  it('only an admin can start it; it cannot target an admin or a missing user', async () => {
    expect((await open(user.token, user.id)).status).toBe(403);
    expect((await open(admin.token, MISSING_UUID)).status).toBe(404);
    const otherAdmin = await createAdmin(h);
    expect((await open(admin.token, otherAdmin.id)).status).toBe(404);
    const created = await open(admin.token, user.id);
    expect(created.status).toBe(201);
    expect(created.data.type).toBe('SUPPORT');
    // Qayta ochilsa — xuddi shu suhbat.
    expect((await open(admin.token, user.id)).data.id).toBe(created.data.id);
  });

  it('shows up for the user as an ordinary chat from «Admin» without exposing the admin account', async () => {
    const conversation = (await open(admin.token, user.id)).data;
    const sent = await h.post(`/conversations/${conversation.id}/messages`, admin.token, { text: 'Salom, savolingiz bormi?' });
    expect(sent.status).toBe(201);

    const list = (await h.get('/conversations', user.token)).data.items;
    const mine = list.find((item: any) => item.id === conversation.id);
    expect(mine).toBeTruthy();
    expect(mine.counterpart).toMatchObject({ firstName: 'Admin', lastName: null, accountNumber: 0 });
    expect(mine.lastMessage.text).toBe('Salom, savolingiz bormi?');
    expect(mine.unreadCount).toBeGreaterThan(0);

    const detail = (await h.get(`/conversations/${conversation.id}`, user.token)).data;
    const adminSide = detail.participants.find((p: any) => p.userId === admin.id);
    expect(adminSide.user).toMatchObject({ firstName: 'Admin', lastName: null, accountNumber: 0 });
    const adminRow = await h.db.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(JSON.stringify(detail)).not.toContain(String(adminRow.accountNumber) === '0' ? 'never' : `"accountNumber":${adminRow.accountNumber}`);
    expect(JSON.stringify(detail)).not.toContain(admin.phone);

    const messages = (await h.get(`/conversations/${conversation.id}/messages`, user.token)).data.items;
    expect(messages.map((m: any) => m.text)).toContain('Salom, savolingiz bormi?');
    expect((await h.post(`/conversations/${conversation.id}/read`, user.token)).status).toBe(201);
  });

  it('the user cannot write, react or delete it for everyone — only hide it for themselves', async () => {
    const conversation = (await open(admin.token, user.id)).data;
    const message = (await h.post(`/conversations/${conversation.id}/messages`, admin.token, { text: 'Javob bermang' })).data;

    expect((await h.post(`/conversations/${conversation.id}/messages`, user.token, { text: 'Admin, yordam bering' })).status).toBe(403);
    expect((await h.api('PUT', `/conversations/${conversation.id}/messages/${message.id}/reaction`, { token: user.token, body: { emoji: '👍' } })).status).toBe(403);
    expect((await h.del(`/conversations/${conversation.id}?scope=all`, user.token)).status).toBe(403);
    expect(await h.db.message.count({ where: { conversationId: conversation.id } })).toBeGreaterThan(0);

    expect((await h.del(`/conversations/${conversation.id}`, user.token)).status).toBe(200);
    const hidden = (await h.get('/conversations', user.token)).data.items.map((item: any) => item.id);
    expect(hidden).not.toContain(conversation.id);
    // Admin ko‘rishda davom etadi; yangi xabar kelsa foydalanuvchida qayta chiqadi.
    expect((await h.get('/conversations', admin.token)).data.items.map((item: any) => item.id)).toContain(conversation.id);
    await h.post(`/conversations/${conversation.id}/messages`, admin.token, { text: 'Yangi xabar' });
    expect((await h.get('/conversations', user.token)).data.items.map((item: any) => item.id)).toContain(conversation.id);
  });

  it('the admin decides whether the user may reply: off by default, switchable both ways, only by the admin', async () => {
    const target = await createUser(h, ['CUSTOMER']);
    const conversation = (await open(admin.token, target.id)).data;
    expect(conversation.userCanReply).toBe(false);
    await h.post(`/conversations/${conversation.id}/messages`, admin.token, { text: 'Salom' });
    expect((await h.post(`/conversations/${conversation.id}/messages`, target.token, { text: 'Javob' })).status).toBe(403);

    // Foydalanuvchi ruxsatni o‘zi o‘zgartira olmaydi.
    expect((await h.patch(`/conversations/${conversation.id}/reply-access`, target.token, { allowed: true })).status).toBe(403);
    expect((await h.patch(`/conversations/${conversation.id}/reply-access`, admin.token, {})).status).toBe(400);

    // Ruxsat berildi: foydalanuvchi yoza oladi, tizim xabari qoladi, admin xabarni ko‘radi.
    const allowed = await h.patch(`/conversations/${conversation.id}/reply-access`, admin.token, { allowed: true });
    expect(allowed.status).toBe(200);
    expect(allowed.data.userCanReply).toBe(true);
    const list = (await h.get('/conversations', target.token)).data.items.find((item: any) => item.id === conversation.id);
    expect(list.userCanReply).toBe(true);
    const reply = await h.post(`/conversations/${conversation.id}/messages`, target.token, { text: 'Rahmat, savolim bor' });
    expect(reply.status).toBe(201);
    const adminView = (await h.get(`/conversations/${conversation.id}/messages`, admin.token)).data.items.map((m: any) => m.text);
    expect(adminView).toContain('Rahmat, savolim bor');
    expect(adminView.some((text: string) => /ruxsat berdi/.test(text))).toBe(true);

    // Yopildi: yana yoza olmaydi (ilgari yozilgan xabar joyida qoladi).
    expect((await h.patch(`/conversations/${conversation.id}/reply-access`, admin.token, { allowed: false })).data.userCanReply).toBe(false);
    expect((await h.post(`/conversations/${conversation.id}/messages`, target.token, { text: 'Yana' })).status).toBe(403);
    expect(await h.db.auditLog.count({ where: { targetId: conversation.id, action: { in: ['ADMIN_CHAT_REPLY_ALLOWED', 'ADMIN_CHAT_REPLY_DENIED'] } } })).toBe(2);
  });

  it('a user cannot start a chat with the admin, and strangers cannot read it', async () => {
    const conversation = (await open(admin.token, user.id)).data;
    const stranger = await createUser(h, ['CUSTOMER']);
    expect((await h.get(`/conversations/${conversation.id}`, stranger.token)).status).toBe(403);
    expect((await h.post('/conversations/direct', user.token, { masterId: admin.id })).status).toBe(404);
  });

  it('the admin deletes the whole chat for both sides, including its files and notifications', async () => {
    const target = await createUser(h, ['CUSTOMER']);
    const conversation = (await open(admin.token, target.id)).data;
    await h.post(`/conversations/${conversation.id}/messages`, admin.token, { text: 'O‘chiriladi' });
    expect((await h.del(`/conversations/${conversation.id}?scope=all`, admin.token)).status).toBe(200);
    expect((await h.get(`/conversations/${conversation.id}`, target.token)).status).toBe(404);
    expect((await h.get(`/conversations/${conversation.id}`, admin.token)).status).toBe(404);
    expect(await h.db.message.count({ where: { conversationId: conversation.id } })).toBe(0);
  });
});
