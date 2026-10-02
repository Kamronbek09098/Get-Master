import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createMaster, firstService, type Harness, type TestMaster } from '../helpers/harness';

let h: Harness;
let service: { id: string };

beforeAll(async () => {
  h = await bootHarness();
  service = await firstService(h);
});
afterAll(async () => {
  await h.close();
});

async function newAsset(m: TestMaster) {
  const profile = await h.db.masterProfile.findFirstOrThrow({ where: { userId: m.id } });
  return h.db.mediaAsset.create({
    data: {
      uploaderId: m.id,
      kind: 'MASTER_VERIFICATION_DOCUMENT',
      status: 'READY',
      linkedResourceType: 'MasterProfile',
      linkedResourceId: profile.id,
      originalKey: `test/${Math.random().toString(36).slice(2)}`,
      originalName: 'doc.png',
      declaredMimeType: 'image/png',
      sizeBytes: 100,
    },
  });
}
const submit = async (m: TestMaster, documentType: string) => h.post('/trust/verifications', m.token, { documentType, mediaAssetId: (await newAsset(m)).id });
const statusOf = async (id: string) => (await h.db.masterVerification.findUniqueOrThrow({ where: { id } })).status;

describe('re-submitting a rejected / correction-requested document', () => {
  it('a pending document still blocks; once REJECTED the same type can be sent again and the old one turns INACTIVE', async () => {
    const m = await createMaster(h, service.id);
    const first = await submit(m, 'IDENTITY');
    expect(first.status).toBe(201);
    expect((await submit(m, 'IDENTITY')).status).toBe(409);

    await h.db.masterVerification.update({ where: { id: first.data.id }, data: { status: 'REJECTED', rejectionReason: 'Aniq emas' } });
    const second = await submit(m, 'IDENTITY');
    expect(second.status).toBe(201);
    expect(await statusOf(first.data.id)).toBe('INACTIVE');
    expect(await statusOf(second.data.id)).toBe('PENDING');

    // Nofaol hujjat umumiy holatga ta’sir qilmaydi: faqat yangisi ko‘rib chiqilmoqda.
    expect((await h.get('/trust/status', m.token)).data.verification).toBe('UNDER_REVIEW');
  });

  it('CORRECTION_REQUESTED works the same way; a VERIFIED document still must be deleted first', async () => {
    const m = await createMaster(h, service.id);
    const a = await submit(m, 'LICENSE');
    await h.db.masterVerification.update({ where: { id: a.data.id }, data: { status: 'CORRECTION_REQUESTED', rejectionReason: 'Tuzating' } });
    const b = await submit(m, 'LICENSE');
    expect(b.status).toBe(201);
    expect(await statusOf(a.data.id)).toBe('INACTIVE');

    await h.db.masterVerification.update({ where: { id: b.data.id }, data: { status: 'VERIFIED' } });
    expect((await submit(m, 'LICENSE')).status).toBe(409);
  });
});
