import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, createUser, type Harness, type TestUser } from '../helpers/harness';

let h: Harness;
let customer: TestUser;

beforeAll(async () => {
  h = await bootHarness();
  customer = await createUser(h, ['CUSTOMER']);
});
afterAll(async () => {
  await h.close();
});

describe('customer profile overview', () => {
  it('requires login and returns exact zero counts for a new account', async () => {
    expect((await h.get('/users/me/overview', undefined)).status).toBe(401);
    const res = await h.get('/users/me/overview', customer.token);
    expect(res.status).toBe(200);
    expect(res.data.totals).toEqual({ requests: 0, orders: 0, masters: 0 });
    expect(res.data.period.days).toBe(30);
    expect(res.data.period.orders).toEqual({ value: 0, previous: 0 });
  });

  it('counts requests in the chosen period and falls back to 30 days for odd values', async () => {
    const service = await h.db.service.findFirstOrThrow();
    await h.db.problemRequest.create({ data: { customerId: customer.id, serviceId: service.id, title: 'Test', description: 'Test tavsif matni', status: 'SUBMITTED' } });
    const res = await h.get('/users/me/overview?days=7', customer.token);
    expect(res.data.totals.requests).toBe(1);
    expect(res.data.period).toMatchObject({ days: 7, requests: { value: 1, previous: 0 } });
    expect((await h.get('/users/me/overview?days=5', customer.token)).data.period.days).toBe(30);
  });
});
