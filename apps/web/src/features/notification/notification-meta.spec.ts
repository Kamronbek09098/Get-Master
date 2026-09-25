import { describe, expect, it } from 'vitest';
import { notificationBody, notificationMeta } from './notification-meta';
import type { AppNotification } from './types';

const make = (template: string, data: Record<string, unknown> = {}): AppNotification => ({
  id: '1',
  title: 't',
  body: 'b',
  template,
  data,
  status: 'SENT',
  readAt: null,
  createdAt: new Date().toISOString(),
});

describe('notificationMeta navigation', () => {
  it('opens the exact conversation, order and request', () => {
    expect(notificationMeta(make('chat.message', { conversationId: 'c1' }), '/ustalar').to).toBe('/ustalar/chat?suhbat=c1');
    expect(notificationMeta(make('order.booked', { orderId: 'o1' }), '/ustalar').to).toBe('/ustalar/buyurtmalar/o1');
    expect(notificationMeta(make('order.status_changed', { orderId: 'o2' }), '/mijozlar').to).toBe('/mijozlar/buyurtmalar/o2');
    expect(notificationMeta(make('offer.received', { requestId: 'r1' }), '/mijozlar').to).toBe('/mijozlar/sorovlar/r1');
  });

  it('falls back to the list when the id is unknown (old notifications)', () => {
    expect(notificationMeta(make('order.booked'), '/ustalar').to).toBe('/ustalar/buyurtmalar');
  });

  it('sends masters to their profile after a verification review and admins to the audit log', () => {
    expect(notificationMeta(make('trust.review', { decision: 'REJECT' }), '/ustalar').to).toBe('/ustalar/profil');
    expect(notificationMeta(make('admin.audit', { action: 'X', path: '/admin/audit' }), '/mijozlar').to).toBe('/admin/audit');
  });
});

describe('notificationBody', () => {
  it('turns raw order status codes into words users understand', () => {
    const item = { ...make('order.status_changed'), body: 'Buyurtma holati: ON_THE_WAY -> ARRIVED.' };
    expect(notificationBody(item)).toBe('Buyurtma holati «Usta yo‘lda» dan «Usta yetib keldi» ga o‘zgardi.');
  });

  it('leaves other notifications untouched', () => {
    const item = { ...make('chat.message'), body: 'Farux sizga xabar yubordi.' };
    expect(notificationBody(item)).toBe('Farux sizga xabar yubordi.');
  });
});
