import { ADMIN_PERMISSIONS } from '../../src/common/constants/admin-permissions';
import { createHmac, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { createJwt, type AccessClaims } from '../../src/common/types/auth.types';
import { TEST_ENV } from '../setup/env';

export interface ApiResult<T = any> {
  status: number;
  body: T;
  headers: Headers;
  data: any;
}

export interface RequestOptions {
  token?: string;
  body?: unknown;
  form?: FormData;
  headers?: Record<string, string>;
  idempotent?: boolean;
  ip?: string;
  cookie?: string;
  rawBody?: string;
}

export interface TestUser {
  id: string;
  phone: string;
  token: string;
  roles: Role[];
}

export interface Harness {
  app: INestApplication;
  db: PrismaService;
  baseUrl: string;
  defaultIp: string;
  api(method: string, path: string, options?: RequestOptions): Promise<ApiResult>;
  get(path: string, token?: string): Promise<ApiResult>;
  post(path: string, token: string | undefined, body?: unknown, options?: RequestOptions): Promise<ApiResult>;
  patch(path: string, token: string | undefined, body?: unknown): Promise<ApiResult>;
  del(path: string, token: string | undefined): Promise<ApiResult>;
  close(): Promise<void>;
}

export async function bootHarness(): Promise<Harness> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true, logger: ['error'] });
  configureApp(app);
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, '127.0.0.1');
  const baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  const db = app.get(PrismaService);
  const defaultIp = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`;

  const api: Harness['api'] = async (method, path, options = {}) => {
    const headers: Record<string, string> = { 'x-forwarded-for': options.ip ?? defaultIp, ...(options.headers ?? {}) };
    if (options.token) headers.cookie = `accessToken=${options.token}`;
    if (options.cookie) headers.cookie = options.cookie;
    if (options.idempotent) headers['idempotency-key'] = `t-${randomUUID()}`;
    let body: BodyInit | undefined;
    if (options.rawBody !== undefined) {
      headers['content-type'] = 'application/json';
      body = options.rawBody;
    } else if (options.form) body = options.form;
    else if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    const response = await fetch(`${baseUrl}/api/v1${path}`, { method, headers, body });
    const text = await response.text();
    let parsed: any = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
    }
    return { status: response.status, body: parsed, headers: response.headers, data: parsed?.data };
  };

  return {
    app,
    db,
    baseUrl,
    defaultIp,
    api,
    get: (path, token) => api('GET', path, { token }),
    post: (path, token, body, options) => api('POST', path, { ...options, token, body }),
    patch: (path, token, body) => api('PATCH', path, { token, body }),
    del: (path, token) => api('DELETE', path, { token }),
    close: () => app.close(),
  };
}

let phoneCounter = 0;
export function uniquePhone(): string {
  phoneCounter += 1;
  const tail = `${Date.now() % 10_000_000}${phoneCounter}`.slice(-7).padStart(7, '0');
  return `+99890${tail}`;
}

export async function createUser(h: Harness, roles: Role[] = ['CUSTOMER'], extra: { firstName?: string } = {}): Promise<TestUser> {
  const phone = uniquePhone();
  const deviceId = `dev-${randomUUID()}`;
  const user = await h.db.user.create({
    data: {
      phone,
      status: 'ACTIVE',
      firstName: extra.firstName ?? 'Test',
      lastName: 'User',
      phoneVerifiedAt: new Date(),
      userRoles: { create: roles.map((role) => ({ role })) },
      deviceSessions: { create: { deviceId } },
    },
  });
  const token = createJwt<AccessClaims>(
    { sub: user.id, roles, status: 'ACTIVE', deviceId, type: 'access' },
    TEST_ENV.JWT_SECRET,
    3600,
  );
  return { id: user.id, phone, token, roles };
}

/** Mavjud foydalanuvchi uchun sessiyali kirish tokeni (API orqali yaratilgan akkauntlar uchun). */
export async function tokenFor(h: Harness, userId: string, roles: Role[]): Promise<string> {
  const deviceId = `dev-${randomUUID()}`;
  await h.db.deviceSession.create({ data: { userId, deviceId } });
  return createJwt<AccessClaims>({ sub: userId, roles, status: 'ACTIVE', deviceId, type: 'access' }, TEST_ENV.JWT_SECRET, 3600);
}

/** Barcha bo‘limlarga huquqi bor oddiy admin (superadmin emas). */
export async function createAdmin(h: Harness, permissions: readonly string[] = ADMIN_PERMISSIONS): Promise<TestUser> {
  const user = await createUser(h, ['ADMIN'], { firstName: 'Admin' });
  await h.db.user.update({ where: { id: user.id }, data: { adminPermissions: [...permissions] } });
  return user;
}

/** Superadmin: boshqa adminlarni yaratish va boshqarish huquqiga ega admin. */
export async function createSuperAdmin(h: Harness): Promise<TestUser> {
  const user = await createUser(h, ['ADMIN'], { firstName: 'Superadmin' });
  await h.db.user.update({ where: { id: user.id }, data: { isSuperAdmin: true } });
  return user;
}

export async function firstService(h: Harness) {
  return h.db.service.findFirstOrThrow({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
}

export async function freshService(h: Harness) {
  const tag = randomUUID().slice(0, 8);
  const category = await h.db.serviceCategory.create({ data: { name: `Test cat ${tag}`, slug: `test-cat-${tag}` } });
  return h.db.service.create({ data: { categoryId: category.id, name: `Test svc ${tag}`, slug: `test-svc-${tag}` } });
}

export interface TestMaster extends TestUser {
  masterId: string;
}

export async function createMaster(
  h: Harness,
  serviceId: string,
  over: { latitude?: number; longitude?: number; workRadiusKm?: number; firstName?: string } = {},
): Promise<TestMaster> {
  const user = await createUser(h, ['CUSTOMER', 'MASTER'], { firstName: over.firstName ?? 'Master' });
  const profile = await h.db.masterProfile.create({
    data: {
      userId: user.id,
      profession: 'Test master',
      status: 'ACTIVE',
      verification: 'VERIFIED',
      latitude: over.latitude,
      longitude: over.longitude,
      workRadiusKm: over.workRadiusKm,
      services: { create: { serviceId, basePrice: 100000, estimatedMinutes: 60 } },
    },
  });
  return { ...user, masterId: profile.id };
}

export async function waitFor<T>(
  probe: () => Promise<T | null | undefined | false>,
  { timeoutMs = 30_000, intervalMs = 250, label = 'condition' } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export async function uploadImage(
  h: Harness,
  token: string,
  kind: string,
  linkType: string,
  linkId: string,
  size = 64,
): Promise<string> {
  const sharp = (await import('sharp')).default;
  const png = await sharp({
    create: { width: size, height: size, channels: 3, background: { r: size % 255, g: 90, b: 160 } },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.set('kind', kind);
  form.set('linkType', linkType);
  form.set('linkId', linkId);
  form.set('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), `photo-${size}.png`);
  const res = await h.api('POST', '/media/uploads', { token, form });
  if (res.status >= 300) throw new Error(`upload failed: ${res.status} ${JSON.stringify(res.body)}`);
  const id: string = res.data.id;
  await waitFor(
    async () => {
      const asset = await h.db.mediaAsset.findUnique({ where: { id } });
      if (asset && (asset.status === 'REJECTED' || asset.status === 'FAILED')) {
        throw new Error(`asset ${id} ended ${asset.status}: ${asset.rejectionReason ?? asset.lastError}`);
      }
      return asset?.status === 'READY';
    },
    { label: `media ${id} READY`, timeoutMs: 60_000 },
  );
  return id;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MISSING_UUID = '00000000-0000-4000-8000-00000000dead';

const DESCRIPTION = 'Integration scenario request with a sufficiently long description.';

let startCounter = 0;
export async function openRequest(h: Harness, customer: TestUser, serviceId: string, status: 'MATCHING' | 'SUBMITTED' = 'MATCHING'): Promise<string> {
  const created = await h.post('/problem-requests', customer.token, {
    // Har bir so‘rov alohida vaqtga: bir ustaning parallel buyurtmalari jadvalda to‘qnashmasin.
    // Ish darhol boshlana olishi uchun vaqt “hozir” atrofida (backend 1 daqiqagacha o‘tmishni qabul qiladi); har so‘rov uchun farqli.
    preferredStartAt: new Date(Date.now() - ((startCounter += 1) % 50) * 1000 - 1000).toISOString(),
    title: `Scenario ${randomUUID().slice(0, 8)}`,
    description: DESCRIPTION,
    serviceId,
    latitude: 41.311,
    longitude: 69.279,
  });
  if (created.status !== 201) throw new Error(`request create failed: ${JSON.stringify(created.body)}`);
  await h.db.problemRequest.update({
    where: { id: created.data.id },
    data: { status, submittedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000) },
  });
  return created.data.id;
}

/** Test buyurtmalarining manzili (openRequest koordinatasi) — «Yetib keldim» uchun joylashuv. */
export const AT_ADDRESS = { latitude: 41.311, longitude: 69.279, accuracy: 5 };

export interface BookedOrder {
  requestId: string;
  offerId: string;
  bookingId: string;
  orderId: string;
}

export async function bookOrder(
  h: Harness,
  customer: TestUser,
  master: TestMaster,
  serviceId: string,
  offer: { price?: number; availableAt?: string; estimatedMinutes?: number } = {},
): Promise<BookedOrder> {
  const requestId = await openRequest(h, customer, serviceId);
  const made = await h.post('/offers', master.token, { requestId, price: offer.price ?? 150000, estimatedMinutes: offer.estimatedMinutes ?? 60, availableAt: offer.availableAt });
  if (made.status !== 201) throw new Error(`offer failed: ${JSON.stringify(made.body)}`);
  const accepted = await h.post(`/offers/${made.data.id}/accept`, customer.token, undefined, { idempotent: true });
  if (accepted.status !== 201) throw new Error(`accept failed: ${JSON.stringify(accepted.body)}`);
  return { requestId, offerId: made.data.id, bookingId: accepted.data.booking.id, orderId: accepted.data.order.id };
}

export async function runWork(h: Harness, order: BookedOrder, customer: TestUser, master: TestMaster, confirm = true): Promise<void> {
  const step = async (path: string, token: string) => {
    const res = await h.post(`/orders/${order.orderId}/${path}`, token, path === 'arrive' ? AT_ADDRESS : undefined);
    if (res.status >= 300) throw new Error(`${path} failed: ${res.status} ${JSON.stringify(res.body)}`);
  };
  await step('confirm', master.token);
  await step('start-travel', master.token);
  await step('arrive', master.token);
  const before = await uploadImage(h, master.token, 'WORK_PROOF', 'Order', order.orderId, 61);
  const b = await h.post(`/orders/${order.orderId}/work-proofs`, master.token, { stage: 'BEFORE', mediaAssetId: before });
  if (b.status !== 201) throw new Error(`BEFORE proof failed: ${JSON.stringify(b.body)}`);
  await step('start-work', master.token);
  const after = await uploadImage(h, master.token, 'WORK_PROOF', 'Order', order.orderId, 62);
  const a = await h.post(`/orders/${order.orderId}/work-proofs`, master.token, { stage: 'AFTER', mediaAssetId: after });
  if (a.status !== 201) throw new Error(`AFTER proof failed: ${JSON.stringify(a.body)}`);
  await step('submit-completion', master.token);
  if (confirm) {
    // Ishni tasdiqlash uchun to'lov to'liq amalga oshgan bo'lishi shart: avval onlayn to'lov muvaffaqiyatli yakunlanadi.
    await payOrder(h, customer, order.orderId);
    await step('confirm-completion', customer.token);
  }
}

export function sendWebhook(h: Harness, payload: Record<string, unknown>, opts: { secret?: string; provider?: string } = {}): Promise<ApiResult> {
  const rawBody = JSON.stringify(payload);
  const signature = createHmac('sha256', opts.secret ?? TEST_ENV.CLICK_SECRET_KEY).update(rawBody).digest('hex');
  return h.api('POST', `/webhooks/payments/${opts.provider ?? 'click'}`, { rawBody, headers: { 'x-webhook-signature': signature } });
}

export async function payOrder(h: Harness, customer: TestUser, orderId: string, status: 'SUCCEEDED' | 'FAILED' = 'SUCCEEDED') {
  const created = await h.post('/payments', customer.token, { orderId, provider: 'CLICK' }, { idempotent: true });
  if (created.status !== 201) throw new Error(`payment create failed: ${JSON.stringify(created.body)}`);
  const payment = created.data.payment;
  const hook = await sendWebhook(h, {
    eventId: `evt-${randomUUID()}`,
    paymentId: payment.id,
    status,
    amount: Number(payment.amount),
    currency: payment.currency,
    providerPaymentId: `prov-${randomUUID().slice(0, 8)}`,
    failureReason: status === 'FAILED' ? 'card declined' : undefined,
  });
  return { payment, hook };
}

/** Buyurtma bajarilishi kerak bo‘lgan vaqt (so‘rov yaratishda majburiy): ertaga. */
export const soon = (): string => new Date(Date.now() + 86_400_000).toISOString();
