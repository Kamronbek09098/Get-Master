import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createMaster, createUser, type Harness, type TestMaster, type TestUser } from '../helpers/harness';

let h: Harness;
let customer: TestUser;
let salonMaster: TestMaster;
let homeMaster: TestMaster;
let salonService: { id: string; categoryId: string };
let homeService: { id: string; categoryId: string };

const body = (extra: Record<string, unknown> = {}) => ({ title: `Soch olish ${randomUUID().slice(0, 6)}`, description: 'Erkaklar soch turmagi kerak', ...extra });

beforeAll(async () => {
  h = await bootHarness();
  const tag = randomUUID().slice(0, 8);
  const salonCategory = await h.db.serviceCategory.create({ data: { name: `Salon ${tag}`, slug: `salon-${tag}`, modes: ['AT_CUSTOMER', 'AT_MASTER'] } });
  salonService = await h.db.service.create({ data: { categoryId: salonCategory.id, name: `Soch ${tag}`, slug: `soch-${tag}` }, select: { id: true, categoryId: true } });
  const homeCategory = await h.db.serviceCategory.create({ data: { name: `Uy ${tag}`, slug: `uy-${tag}` } });
  homeService = await h.db.service.create({ data: { categoryId: homeCategory.id, name: `Quvur ${tag}`, slug: `quvur-${tag}` }, select: { id: true, categoryId: true } });
  customer = await createUser(h);
  salonMaster = await createMaster(h, salonService.id, { latitude: 41.3, longitude: 69.28, workRadiusKm: 5 });
  await h.db.masterProfile.update({ where: { id: salonMaster.masterId }, data: { serviceModes: ['AT_MASTER'], placeAddress: 'Chilonzor 5, sartaroshxona' } });
  homeMaster = await createMaster(h, salonService.id, { latitude: 41.31, longitude: 69.27, workRadiusKm: 10 });
});
afterAll(async () => {
  await h.close();
});

describe('service modes: at customer vs at master place', () => {
  it('exposes category modes publicly', async () => {
    const res = await h.get('/service-categories', undefined);
    const salon = res.data.find((item: { id: string }) => item.id === salonService.categoryId);
    expect(salon.modes).toEqual(['AT_CUSTOMER', 'AT_MASTER']);
    expect(res.data.find((item: { id: string }) => item.id === homeService.categoryId).modes).toEqual(['AT_CUSTOMER']);
  });

  it('requires a place address and map point when a master works at their own place', async () => {
    const user = await createUser(h, ['CUSTOMER']);
    const res = await h.post('/masters/me', user.token, { profession: 'Sartarosh', serviceModes: ['AT_MASTER'] });
    expect(res.status).toBe(400);
    const empty = await h.post('/masters/me', user.token, { profession: 'Sartarosh', serviceModes: [] });
    expect(empty.status).toBe(400);
    const ok = await h.post('/masters/me', user.token, { profession: 'Sartarosh', serviceModes: ['AT_MASTER'], placeAddress: 'Yunusobod 4', latitude: 41.35, longitude: 69.29 });
    expect(ok.status).toBe(201);
    expect(ok.data.serviceModes).toEqual(['AT_MASTER']);
    expect(ok.data.placeAddress).toBe('Yunusobod 4');
  });

  it('customer request: address is mandatory only when the master comes to the customer', async () => {
    const noAddress = await h.post('/problem-requests', customer.token, body({ serviceId: salonService.id }));
    expect(noAddress.status).toBe(400);
    const atMaster = await h.post('/problem-requests', customer.token, body({ serviceId: salonService.id, serviceMode: 'AT_MASTER' }));
    expect(atMaster.status).toBe(201);
    expect(atMaster.data.serviceMode).toBe('AT_MASTER');
    const unsupported = await h.post('/problem-requests', customer.token, body({ serviceId: homeService.id, serviceMode: 'AT_MASTER' }));
    expect(unsupported.status).toBe(400);
    expect((await h.post('/problem-requests', customer.token, body({ serviceId: salonService.id, serviceMode: 'FLYING' }))).status).toBe(400);
  });

  it('only masters who work in the requested mode can offer; AT_MASTER booking and arrival skip the travel step', async () => {
    const created = await h.post('/problem-requests', customer.token, body({ serviceId: salonService.id, serviceMode: 'AT_MASTER', latitude: 41.31, longitude: 69.28 }));
    await h.db.problemRequest.update({ where: { id: created.data.id }, data: { status: 'MATCHING', submittedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000) } });
    // Mijozga boradigan usta o‘z joyida ishlamaydi → taklif bera olmaydi.
    const wrong = await h.post('/offers', homeMaster.token, { requestId: created.data.id, price: 80000, estimatedMinutes: 40 });
    expect(wrong.status).toBe(403);
    const offer = await h.post('/offers', salonMaster.token, { requestId: created.data.id, price: 90000, estimatedMinutes: 40 });
    expect(offer.status).toBe(201);
    const accepted = await h.post(`/offers/${offer.data.id}/accept`, customer.token, undefined, { idempotent: true });
    expect(accepted.status).toBe(201);
    expect(accepted.data.booking.locationSnapshot).toMatchObject({ atMaster: true, addressLine: 'Chilonzor 5, sartaroshxona' });
    const orderId = accepted.data.order.id;
    expect((await h.post(`/orders/${orderId}/confirm`, salonMaster.token)).status).toBe(201);
    const arrived = await h.post(`/orders/${orderId}/arrive`, salonMaster.token);
    expect(arrived.status).toBe(201);
    const detail = await h.get(`/orders/${orderId}`, customer.token);
    expect(detail.data.request.serviceMode).toBe('AT_MASTER');
    expect(detail.data.location).toMatchObject({ atMaster: true, addressLine: 'Chilonzor 5, sartaroshxona' });
  });

  it('catalog filters by mode and shows place info', async () => {
    const res = await h.api('GET', '/masters?mode=AT_MASTER&limit=50', { token: customer.token });
    expect(res.status).toBe(200);
    const ids = res.data.items.map((item: { id: string }) => item.id);
    expect(ids).toContain(salonMaster.masterId);
    expect(ids).not.toContain(homeMaster.masterId);
    const item = res.data.items.find((entry: { id: string }) => entry.id === salonMaster.masterId);
    expect(item.serviceModes).toEqual(['AT_MASTER']);
    expect(item.placeAddress).toBe('Chilonzor 5, sartaroshxona');
    const open = await h.api('GET', '/public/masters?limit=24');
    expect(open.status).toBe(200);
  });
});
