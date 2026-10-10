import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AT_ADDRESS, bookOrder, bootHarness, createMaster, createUser, firstService, type Harness, type TestMaster, type TestUser, uploadImage, waitFor } from '../helpers/harness';
import { OrderReminderService } from '../../src/modules/order/order-reminder.service';

let h: Harness;
let service: { id: string };
let customer: TestUser;
let master: TestMaster;

beforeAll(async () => {
  h = await bootHarness();
  service = await firstService(h);
  customer = await createUser(h, ['CUSTOMER']);
  master = await createMaster(h, service.id);
});
afterAll(async () => {
  await h.close();
});

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
const notified = (userId: string, template: string) =>
  waitFor(() => h.db.notification.findFirst({ where: { userId, template } }), { label: `${template} notification for ${userId}` });

/** Ishni "Ishni boshlash"gacha ARRIVED holatiga olib boradi va BEFORE isbotini yuklaydi (start-work chaqirmasdan). */
async function readyToStartWork(pro: TestMaster, orderId: string) {
  const step = async (path: string) => {
    const res = await h.post(`/orders/${orderId}/${path}`, pro.token, path === 'arrive' ? AT_ADDRESS : undefined);
    if (res.status >= 300) throw new Error(`${path} failed: ${res.status} ${JSON.stringify(res.body)}`);
  };
  await step('confirm');
  await step('start-travel');
  await step('arrive');
  const before = await uploadImage(h, pro.token, 'WORK_PROOF', 'Order', orderId, 61);
  const res = await h.post(`/orders/${orderId}/work-proofs`, pro.token, { stage: 'BEFORE', mediaAssetId: before });
  if (res.status !== 201) throw new Error(`BEFORE proof failed: ${JSON.stringify(res.body)}`);
}

describe('scheduled start time gates "Ishni boshlash"', () => {
  it('blocks start-work before the scheduled time, and allows it once the time has passed', async () => {
    const order = await bookOrder(h, customer, master, service.id, { availableAt: hoursFromNow(2) });
    await readyToStartWork(master, order.orderId);

    const early = await h.post(`/orders/${order.orderId}/start-work`, master.token);
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('WORK_TOO_EARLY');
    expect((await h.db.order.findUniqueOrThrow({ where: { id: order.orderId } })).status).toBe('ARRIVED');

    await h.db.booking.update({ where: { id: order.bookingId }, data: { scheduledStartAt: new Date(Date.now() - 1000) } });
    const onTime = await h.post(`/orders/${order.orderId}/start-work`, master.token);
    expect(onTime.status).toBe(201);
    expect(onTime.data.status).toBe('IN_PROGRESS');
  });

  it('never gates orders with no scheduled time', async () => {
    const pro = await createMaster(h, service.id);
    const order = await bookOrder(h, customer, pro, service.id);
    await readyToStartWork(pro, order.orderId);
    expect((await h.post(`/orders/${order.orderId}/start-work`, pro.token)).status).toBe(201);
  });
});

describe('POST /orders/:id/reschedule — mutual agreement to change the time', () => {
  it('lets either side propose, and the other side accept — the schedule actually changes', async () => {
    const buyer = await createUser(h, ['CUSTOMER']);
    const pro = await createMaster(h, service.id);
    const order = await bookOrder(h, buyer, pro, service.id, { availableAt: hoursFromNow(5) });
    const newTime = hoursFromNow(8);

    const proposed = await h.post(`/orders/${order.orderId}/reschedule`, buyer.token, { scheduledStartAt: newTime });
    expect(proposed.status).toBe(201);
    await notified(pro.id, 'order.reschedule_proposed');

    const seenByMaster = await h.get(`/orders/${order.orderId}`, pro.token);
    expect(seenByMaster.data.reschedule).toMatchObject({ proposedByMe: false });
    expect(new Date(seenByMaster.data.reschedule.proposedStartAt).toISOString()).toBe(newTime);

    const seenByCustomer = await h.get(`/orders/${order.orderId}`, buyer.token);
    expect(seenByCustomer.data.reschedule.proposedByMe).toBe(true);

    const accepted = await h.post(`/orders/${order.orderId}/reschedule/accept`, pro.token);
    expect(accepted.status).toBe(201);
    const booking = await h.db.booking.findUniqueOrThrow({ where: { id: order.bookingId } });
    expect(booking.scheduledStartAt?.toISOString()).toBe(newTime);
    expect(booking.proposedStartAt).toBeNull();
    expect(booking.proposedById).toBeNull();

    await notified(buyer.id, 'order.reschedule_accepted');
  });

  it('lets the other side decline — nothing changes', async () => {
    const buyer = await createUser(h, ['CUSTOMER']);
    const pro = await createMaster(h, service.id);
    const order = await bookOrder(h, buyer, pro, service.id, { availableAt: hoursFromNow(5) });
    const original = (await h.db.booking.findUniqueOrThrow({ where: { id: order.bookingId } })).scheduledStartAt;

    await h.post(`/orders/${order.orderId}/reschedule`, pro.token, { scheduledStartAt: hoursFromNow(9) });
    const declined = await h.post(`/orders/${order.orderId}/reschedule/decline`, buyer.token);
    expect(declined.status).toBe(201);

    const booking = await h.db.booking.findUniqueOrThrow({ where: { id: order.bookingId } });
    expect(booking.scheduledStartAt?.toISOString()).toBe(original?.toISOString());
    expect(booking.proposedStartAt).toBeNull();

    await notified(pro.id, 'order.reschedule_declined');
  });

  it('rejects a past proposed time, self-acceptance, non-participants, and accepting when nothing is pending', async () => {
    const buyer = await createUser(h, ['CUSTOMER']);
    const pro = await createMaster(h, service.id);
    const order = await bookOrder(h, buyer, pro, service.id, { availableAt: hoursFromNow(5) });
    const outsider = await createUser(h, ['CUSTOMER']);

    expect((await h.post(`/orders/${order.orderId}/reschedule`, buyer.token, { scheduledStartAt: hoursFromNow(-1) })).status).toBe(400);
    expect((await h.post(`/orders/${order.orderId}/reschedule`, outsider.token, { scheduledStartAt: hoursFromNow(6) })).status).toBe(403);
    expect((await h.post(`/orders/${order.orderId}/reschedule/accept`, pro.token)).status).toBe(409);

    const proposed = await h.post(`/orders/${order.orderId}/reschedule`, buyer.token, { scheduledStartAt: hoursFromNow(6) });
    expect(proposed.status).toBe(201);
    expect((await h.post(`/orders/${order.orderId}/reschedule/accept`, buyer.token)).status).toBe(403);
    expect((await h.post(`/orders/${order.orderId}/reschedule/decline`, outsider.token)).status).toBe(403);
  });

  it('refuses to reschedule once work has already started', async () => {
    const buyer = await createUser(h, ['CUSTOMER']);
    const pro = await createMaster(h, service.id);
    const order = await bookOrder(h, buyer, pro, service.id, { availableAt: hoursFromNow(2) });
    await readyToStartWork(pro, order.orderId);
    await h.db.booking.update({ where: { id: order.bookingId }, data: { scheduledStartAt: new Date(Date.now() - 1000) } });
    expect((await h.post(`/orders/${order.orderId}/start-work`, pro.token)).status).toBe(201);

    const res = await h.post(`/orders/${order.orderId}/reschedule`, buyer.token, { scheduledStartAt: hoursFromNow(3) });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('RESCHEDULE_NOT_ALLOWED');
  });
});

describe('order.reminder — sent to both sides shortly before the scheduled time', () => {
  it('notifies the customer and the master exactly once as the time approaches', async () => {
    const buyer = await createUser(h, ['CUSTOMER']);
    const pro = await createMaster(h, service.id);
    await bookOrder(h, buyer, pro, service.id, { availableAt: hoursFromNow(0.4) });
    const reminder = h.app.get(OrderReminderService);

    await reminder.sweep();
    await notified(buyer.id, 'order.reminder');
    await notified(pro.id, 'order.reminder');

    await reminder.sweep();
    const countAfter = await h.db.notification.count({ where: { template: 'order.reminder', OR: [{ userId: buyer.id }, { userId: pro.id }] } });
    expect(countAfter).toBe(2);
  });

  it('does not remind orders scheduled far in the future', async () => {
    const buyer = await createUser(h, ['CUSTOMER']);
    const pro = await createMaster(h, service.id);
    const order = await bookOrder(h, buyer, pro, service.id, { availableAt: hoursFromNow(5) });
    const reminder = h.app.get(OrderReminderService);
    await reminder.sweep();
    const count = await h.db.notification.count({
      where: { userId: buyer.id, template: 'order.reminder', data: { path: ['orderId'], equals: order.orderId } },
    });
    expect(count).toBe(0);
  });
});
