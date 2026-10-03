import { ConsoleLogger, Logger } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { bootHarness, createUser, type Harness, UUID_RE } from '../helpers/harness';

let h: Harness;
beforeAll(async () => {
  h = await bootHarness();
});
afterAll(async () => {
  await h.close();
});

describe('seed hygiene — the production seed contains only reference data', () => {
  it('ships policies and the service catalog, and no accounts or transactional rows', async () => {
    const counts = inject('seedCounts' as never) as Record<string, number>;
    expect(counts.policies).toBeGreaterThan(0);
    expect(counts.categories).toBeGreaterThan(0);
    expect(counts.services).toBeGreaterThan(0);
    const { policies, categories, services, ...mustBeEmpty } = counts;
    expect(mustBeEmpty).toEqual(Object.fromEntries(Object.keys(mustBeEmpty).map((k) => [k, 0])));
  });
});

describe('K01 — health, request-id, error envelope', () => {
  it('reports liveness and readiness (DB + Redis)', async () => {
    const live = await h.get('/health');
    expect(live.status).toBe(200);
    expect(live.data.status).toBe('ok');
    const ready = await h.get('/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.data).toMatchObject({ status: 'ready', database: 'up', redis: 'up' });
  });

  it('echoes a caller request id and generates one otherwise', async () => {
    const echoed = await h.api('GET', '/health', { headers: { 'x-request-id': 'trace-abc-123' } });
    expect(echoed.headers.get('x-request-id')).toBe('trace-abc-123');
    const generated = await h.api('GET', '/health');
    expect(generated.headers.get('x-request-id')).toMatch(UUID_RE);
  });

  it('uses one stable error envelope for auth, validation and unknown routes', async () => {
    const unauth = await h.get('/orders');
    expect(unauth.status).toBe(401);
    expect(unauth.body).toMatchObject({ success: false, statusCode: 401, code: 'UNAUTHORIZED' });
    expect(unauth.body.requestId).toMatch(UUID_RE);

    const invalid = await h.post('/auth/login', undefined, { phone: 'not-a-phone', extra: 1 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(invalid.body.details)).toBe(true);

    const unknown = await h.get('/definitely/not/a/route');
    expect(unknown.status).toBe(404);
    expect(unknown.body.success).toBe(false);
  });

  it('exposes Prometheus metrics as plain text (not the JSON envelope)', async () => {
    await h.api('GET', '/health');
    // Token yo‘q yoki noto‘g‘ri bo‘lsa — yopiq; to‘g‘ri token bilan ochiladi.
    const { ConfigService } = await import('@nestjs/config');
    const config = h.app.get(ConfigService);
    if (!config.get('METRICS_TOKEN')) process.env.METRICS_TOKEN = 'test-metrics-token-0123456789abcdef';
    const token = config.get<string>('METRICS_TOKEN');
    expect((await h.api('GET', '/metrics')).status).toBe(401);
    expect((await h.api('GET', '/metrics', { headers: { authorization: 'Bearer wrong' } })).status).toBe(401);
    const res = await h.api('GET', '/metrics', { headers: { authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/plain/);
    expect(typeof res.body).toBe('string');
    expect(res.body).toMatch(/http_request_duration_seconds_count\{[^}]*route="\/api\/v1\/health"/);
    expect(res.body).toMatch(/# TYPE queue_depth gauge/);
    expect(res.body).toMatch(/# TYPE payment_failure_total counter/);
  });

  it('never leaks stack traces or internals in error bodies', async () => {
    const res = await h.post('/auth/login', undefined, { phone: '+998900000000', password: 'x' });
    expect(JSON.stringify(res.body)).not.toMatch(/stack|node_modules|prisma|at \w+ \(/i);
  });
});

describe('K01 — secure logging', () => {
  it('logs every request outcome with request id/route/status, but never secrets, bodies, query strings or tokens', async () => {
    const lines: string[] = [];
    const capture = (...args: unknown[]) => lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    class Capturing extends ConsoleLogger {
      override log(...args: unknown[]) { capture(...args); }
      override warn(...args: unknown[]) { capture(...args); }
      override error(...args: unknown[]) { capture(...args); }
    }
    Logger.overrideLogger(new Capturing());
    try {
      const user = await createUser(h);
      const SECRET_PASSWORD = 'SuperSecret-Passw0rd!';
      const SECRET_QUERY = 'q-secret-value-123';
      await h.api('POST', '/auth/login', { body: { phone: user.phone, password: SECRET_PASSWORD } });
      await h.api('GET', `/notifications?channel=${SECRET_QUERY}`, { token: user.token });
      await h.api('GET', '/orders', { cookie: 'accessToken=eyJhbGciOiJIUzI1NiJ9.forged.token' });
      await h.api('GET', '/notifications', { token: user.token });
      await new Promise((r) => setTimeout(r, 200));

      const joined = lines.join('\n');
      expect(joined).toContain('"route":"/api/v1/notifications"');
      expect(joined).toMatch(/"statusCode":401/);
      expect(joined).toMatch(/"requestId":"[0-9a-f-]{36}"/);
      for (const secret of [SECRET_PASSWORD, SECRET_QUERY, user.token, 'forged.token', user.phone]) {
        expect(joined, `log leaked ${secret.slice(0, 12)}…`).not.toContain(secret);
      }
    } finally {
      Logger.overrideLogger(new ConsoleLogger('test', { logLevels: ['error'] }));
    }
  });
});
