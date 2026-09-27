import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookOrder, bootHarness, createMaster, createUser, firstService, type Harness, type TestMaster, type TestUser } from '../helpers/harness';

const CLICK_MERCHANT_ID = 'test-click-merchant';
const CLICK_SERVICE_ID = 'test-click-service';
const CLICK_SECRET_KEY = 'test-only-click-webhook-secret'; // TEST_ENV bilan bir xil (umumiy webhook testlari ham shu kalitdan foydalanadi)
const PAYME_MERCHANT_ID = 'test-payme-merchant';
const PAYME_SECRET_KEY = 'test-only-payme-secret';

let h: Harness;
let service: { id: string };
let customer: TestUser;
let master: TestMaster;

beforeAll(async () => {
  process.env.CLICK_MERCHANT_ID = CLICK_MERCHANT_ID;
  process.env.CLICK_SERVICE_ID = CLICK_SERVICE_ID;
  process.env.CLICK_SECRET_KEY = CLICK_SECRET_KEY;
  process.env.PAYME_MERCHANT_ID = PAYME_MERCHANT_ID;
  process.env.PAYME_SECRET_KEY = PAYME_SECRET_KEY;

  h = await bootHarness();
  service = await firstService(h);
  customer = await createUser(h, ['CUSTOMER']);
  master = await createMaster(h, service.id);
});

afterAll(async () => {
  await h.close();
  delete process.env.CLICK_MERCHANT_ID;
  delete process.env.CLICK_SERVICE_ID;
  delete process.env.PAYME_MERCHANT_ID;
  delete process.env.PAYME_SECRET_KEY;
});

async function createClickPayment(price = 150000) {
  const order = await bookOrder(h, customer, master, service.id, { price });
  const res = await h.post('/payments', customer.token, { orderId: order.orderId, provider: 'CLICK' }, { idempotent: true });
  expect(res.status).toBe(201);
  return { orderId: order.orderId, payment: res.data.payment, checkoutUrl: res.data.checkoutUrl as string };
}

function clickSign(parts: (string | number)[]): string {
  return createHash('md5').update(parts.join('')).digest('hex');
}

describe('Click merchant API — real Prepare/Complete protocol', () => {
  it('produces a real my.click.uz checkout URL once merchant credentials are configured', async () => {
    const { checkoutUrl, payment } = await createClickPayment();
    expect(checkoutUrl).toContain('https://my.click.uz/services/pay?');
    expect(checkoutUrl).toContain(`service_id=${CLICK_SERVICE_ID}`);
    expect(checkoutUrl).toContain(`merchant_id=${CLICK_MERCHANT_ID}`);
    expect(checkoutUrl).toContain(`transaction_param=${payment.id}`);
  });

  it('rejects a bad signature without changing anything', async () => {
    const { payment } = await createClickPayment();
    const body = {
      click_trans_id: '900001',
      service_id: CLICK_SERVICE_ID,
      merchant_trans_id: payment.id,
      amount: Number(payment.amount).toFixed(2),
      action: '0',
      sign_time: '2026-01-01 00:00:00',
      sign_string: 'deadbeef',
    };
    const res = await h.api('POST', '/payments/click/callback', { body });
    expect(res.status).toBe(200);
    expect(res.body.error).toBe(-1);
    expect((await h.db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('PENDING');
  });

  it('walks Prepare then Complete to a settled payment, and is idempotent on replay', async () => {
    const { payment } = await createClickPayment(220000);
    const amount = Number(payment.amount).toFixed(2);
    const clickTransId = `900${Math.floor(Math.random() * 100000)}`;
    const prepareSignTime = '2026-01-01 00:01:00';
    const prepareSign = clickSign([clickTransId, CLICK_SERVICE_ID, CLICK_SECRET_KEY, payment.id, amount, '0', prepareSignTime]);

    const prepareRes = await h.api('POST', '/payments/click/callback', {
      body: { click_trans_id: clickTransId, service_id: CLICK_SERVICE_ID, merchant_trans_id: payment.id, amount, action: '0', sign_time: prepareSignTime, sign_string: prepareSign },
    });
    expect(prepareRes.body.error).toBe(0);
    const prepareId = prepareRes.body.merchant_prepare_id;
    expect(typeof prepareId).toBe('number');
    expect((await h.db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('PROCESSING');

    const completeSignTime = '2026-01-01 00:02:00';
    const completeSign = clickSign([clickTransId, CLICK_SERVICE_ID, CLICK_SECRET_KEY, payment.id, prepareId, amount, '1', completeSignTime]);
    const completeBody = { click_trans_id: clickTransId, service_id: CLICK_SERVICE_ID, merchant_trans_id: payment.id, merchant_prepare_id: prepareId, amount, action: '1', sign_time: completeSignTime, sign_string: completeSign };

    const completeRes = await h.api('POST', '/payments/click/callback', { body: completeBody });
    expect(completeRes.body.error).toBe(0);
    expect(completeRes.body.merchant_confirm_id).toBe(prepareId);
    const settled = await h.db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(settled.status).toBe('SUCCEEDED');
    expect(settled.providerPaymentId).toBe(clickTransId);

    // Click Complete so'rovini takror yuborsa (tarmoq retry), natija o'zgarmasdan xuddi shu javob qaytishi kerak.
    const replay = await h.api('POST', '/payments/click/callback', { body: completeBody });
    expect(replay.body.error).toBe(0);
    expect(replay.body.merchant_confirm_id).toBe(prepareId);
    expect((await h.db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('SUCCEEDED');
  });

  it('refuses Complete when no matching Prepare exists', async () => {
    const { payment } = await createClickPayment();
    const amount = Number(payment.amount).toFixed(2);
    const signTime = '2026-01-01 00:03:00';
    const sign = clickSign(['900999', CLICK_SERVICE_ID, CLICK_SECRET_KEY, payment.id, 777, amount, '1', signTime]);
    const res = await h.api('POST', '/payments/click/callback', {
      body: { click_trans_id: '900999', service_id: CLICK_SERVICE_ID, merchant_trans_id: payment.id, merchant_prepare_id: 777, amount, action: '1', sign_time: signTime, sign_string: sign },
    });
    expect(res.body.error).toBe(-6);
  });
});

describe('Payme JSON-RPC — real merchant API protocol', () => {
  const authHeader = `Basic ${Buffer.from(`Paycom:${PAYME_SECRET_KEY}`).toString('base64')}`;

  async function createPaymePayment(price = 175000) {
    const order = await bookOrder(h, customer, master, service.id, { price });
    const res = await h.post('/payments', customer.token, { orderId: order.orderId, provider: 'PAYME' }, { idempotent: true });
    expect(res.status).toBe(201);
    return { payment: res.data.payment, checkoutUrl: res.data.checkoutUrl as string };
  }

  it('produces a real checkout.test.paycom.uz checkout URL once merchant credentials are configured', async () => {
    const { checkoutUrl } = await createPaymePayment();
    expect(checkoutUrl).toContain('https://checkout.test.paycom.uz/');
  });

  it('rejects requests without valid Basic auth', async () => {
    const res = await h.api('POST', '/payments/payme', { body: { jsonrpc: '2.0', id: 1, method: 'CheckPerformTransaction', params: {} } });
    expect(res.body.error.code).toBe(-32504);
  });

  it('walks CheckPerformTransaction → CreateTransaction → PerformTransaction → CheckTransaction to a settled payment', async () => {
    const { payment } = await createPaymePayment(300000);
    const amount = Math.round(Number(payment.amount) * 100);
    const account = { order_id: payment.id };
    const rpc = (method: string, params: Record<string, unknown>, id = 1) =>
      h.api('POST', '/payments/payme', { body: { jsonrpc: '2.0', id, method, params }, headers: { authorization: authHeader } });

    const check = await rpc('CheckPerformTransaction', { amount, account });
    expect(check.body.result.allow).toBe(true);

    const paymeTransId = `ptx-${randomUUID().slice(0, 12)}`;
    const create = await rpc('CreateTransaction', { id: paymeTransId, time: Date.now(), amount, account });
    expect(create.body.result.state).toBe(1);
    expect(create.body.result.transaction).toBe(payment.id);
    expect((await h.db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('PROCESSING');

    // Takroriy CreateTransaction (retry) — bir xil natijani qaytarishi kerak, yangi qator yaratmasdan.
    const createAgain = await rpc('CreateTransaction', { id: paymeTransId, time: Date.now(), amount, account });
    expect(createAgain.body.result.state).toBe(1);

    const perform = await rpc('PerformTransaction', { id: paymeTransId });
    expect(perform.body.result.state).toBe(2);
    const settled = await h.db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(settled.status).toBe('SUCCEEDED');
    expect(settled.providerPaymentId).toBe(paymeTransId);

    const perfromAgain = await rpc('PerformTransaction', { id: paymeTransId });
    expect(perfromAgain.body.result.state).toBe(2);

    const check2 = await rpc('CheckTransaction', { id: paymeTransId });
    expect(check2.body.result.state).toBe(2);
    expect(check2.body.result.perform_time).toBeGreaterThan(0);

    const statement = await rpc('GetStatement', { from: 0, to: Date.now() + 60_000 });
    expect(statement.body.result.transactions.some((t: any) => t.id === paymeTransId)).toBe(true);
  });

  it('cancels a not-yet-performed transaction with state -1', async () => {
    const { payment } = await createPaymePayment(90000);
    const amount = Math.round(Number(payment.amount) * 100);
    const account = { order_id: payment.id };
    const rpc = (method: string, params: Record<string, unknown>, id = 1) =>
      h.api('POST', '/payments/payme', { body: { jsonrpc: '2.0', id, method, params }, headers: { authorization: authHeader } });

    const paymeTransId = `ptx-${randomUUID().slice(0, 12)}`;
    await rpc('CreateTransaction', { id: paymeTransId, time: Date.now(), amount, account });
    const cancel = await rpc('CancelTransaction', { id: paymeTransId, reason: 3 });
    expect(cancel.body.result.state).toBe(-1);
    expect((await h.db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('FAILED');
  });

  it('reports an unknown transaction id as -31003', async () => {
    const res = await h.api('POST', '/payments/payme', { body: { jsonrpc: '2.0', id: 1, method: 'CheckTransaction', params: { id: 'nope' } }, headers: { authorization: authHeader } });
    expect(res.body.error.code).toBe(-31003);
  });
});
