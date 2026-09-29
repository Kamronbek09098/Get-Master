import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createAdmin, createMaster, createUser, firstService, type Harness, MISSING_UUID, type TestUser } from '../helpers/harness';

interface RouteInfo {
  method: string;
  path: string;
  params: string[];
}

const SKIP_PREFIXES = ['/api/v1/auth', '/api/v1/otp', '/api/v1/webhooks'];
const isIdParam = (name: string) => /(^|[a-z])id$/i.test(name);
// GET /masters/:id deliberately accepts either a UUID or a numeric account number (dual-format
// public lookup) and does its own format check, returning 404 — not 400 — for anything else.
const ACCEPTS_NON_UUID = new Set(['GET /api/v1/masters/:id']);

function listRoutes(h: Harness): RouteInfo[] {
  const server = h.app.getHttpAdapter().getInstance() as any;
  const stack: any[] = server._router?.stack ?? server.router?.stack ?? [];
  const routes: RouteInfo[] = [];
  for (const layer of stack) {
    if (!layer.route) continue;
    for (const method of Object.keys(layer.route.methods)) {
      const path: string = layer.route.path;
      routes.push({ method: method.toUpperCase(), path, params: [...path.matchAll(/:([A-Za-z]+)/g)].map((m) => m[1]!) });
    }
  }
  return routes.filter((r) => !SKIP_PREFIXES.some((p) => r.path.startsWith(p)));
}

function fill(route: RouteInfo, idValue: string): string {
  return route.path.replace(/:([A-Za-z]+)/g, (_m, name: string) => (isIdParam(name) ? idValue : name === 'variant' ? 'original' : 'x')).replace(/^\/api\/v1/, '');
}

let h: Harness;
let tokens: Array<{ role: string; token: string }>;
let routes: RouteInfo[];

beforeAll(async () => {
  h = await bootHarness();
  const service = await firstService(h);
  const admin = await createAdmin(h);
  const customer = await createUser(h, ['CUSTOMER']);
  const master = await createMaster(h, service.id);
  tokens = [
    { role: 'ADMIN', token: admin.token },
    { role: 'CUSTOMER', token: customer.token },
    { role: 'MASTER', token: master.token },
  ];
  routes = listRoutes(h);
});
afterAll(async () => {
  await h.close();
});

async function call(route: RouteInfo, path: string, token: string) {
  return h.api(route.method, path, {
    token,
    body: route.method === 'GET' || route.method === 'DELETE' ? undefined : {},
    idempotent: route.method === 'POST',
  });
}

describe('route sweep', () => {
  it('discovers the application routes', () => {
    expect(routes.length).toBeGreaterThan(60);
  });

  it('non-UUID ids are rejected with 400 — never 500', async () => {
    const withIds = routes.filter((r) => r.params.some(isIdParam));
    expect(withIds.length).toBeGreaterThan(20);
    const offenders: string[] = [];
    const unreached: string[] = [];
    for (const route of withIds) {
      const statuses: number[] = [];
      for (const { token } of tokens) {
        const res = await call(route, fill(route, 'not-a-uuid'), token);
        statuses.push(res.status);
      }
      if (statuses.some((s) => s >= 500)) offenders.push(`${route.method} ${route.path} → ${statuses}`);
      if (!statuses.includes(400) && !ACCEPTS_NON_UUID.has(`${route.method} ${route.path}`)) unreached.push(`${route.method} ${route.path} → ${statuses}`);
    }
    expect(offenders).toEqual([]);
    expect(unreached).toEqual([]);
  });

  it('well-formed but nonexistent UUIDs never 500 and never succeed', async () => {
    const withIds = routes.filter((r) => r.params.some(isIdParam));
    const offenders: string[] = [];
    for (const route of withIds) {
      for (const { role, token } of tokens) {
        const res = await call(route, fill(route, MISSING_UUID), token);
        if (res.status >= 500) offenders.push(`${role} ${route.method} ${route.path} → ${res.status}`);
        if (res.status >= 200 && res.status < 300 && route.method !== 'GET') {
          offenders.push(`${role} ${route.method} ${route.path} → ${res.status} (unexpected success)`);
        }
        if (res.status >= 200 && res.status < 300 && route.method === 'GET' && !route.path.includes('/media/')) {
          offenders.push(`${role} ${route.method} ${route.path} → ${res.status} (unexpected success)`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('malformed query strings never 500', async () => {
    const offenders: string[] = [];
    const gets = routes.filter((r) => r.method === 'GET' && !r.params.some(isIdParam));
    const bad = ['limit=abc', 'limit=-5', 'limit=100000', 'cursor=zzz', 'status=BOGUS', 'from=notadate', 'sort=sideways', 'q=%00'];
    for (const route of gets) {
      const base = fill(route, MISSING_UUID);
      for (const query of bad) {
        for (const { role, token } of tokens) {
          const res = await h.get(`${base}?${query}`, token);
          if (res.status >= 500) offenders.push(`${role} GET ${base}?${query} → ${res.status}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('malformed JSON bodies never 500', async () => {
    const offenders: string[] = [];
    const writes = routes.filter((r) => ['POST', 'PATCH', 'PUT'].includes(r.method));
    for (const route of writes) {
      const path = fill(route, MISSING_UUID);
      for (const { role, token } of tokens) {
        const res = await fetch(`${h.baseUrl}/api/v1${path}`, {
          method: route.method,
          headers: { cookie: `accessToken=${token}`, 'content-type': 'application/json', 'idempotency-key': `f-${Math.random()}` },
          body: '{"broken": ',
        });
        if (res.status >= 500) offenders.push(`${role} ${route.method} ${path} → ${res.status}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

export type { TestUser };
