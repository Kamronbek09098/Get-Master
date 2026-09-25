import { describe, expect, it } from 'vitest';
import { notificationMeta, notificationText } from './notification-meta';
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

describe('notificationText', () => {
  it('rewrites legacy raw-status notifications into what actually happened', () => {
    const raw = { ...make('order.status_changed'), title: 'Buyurtma holati o\'zgardi', body: 'Buyurtma holati: CONFIRMED -> ON_THE_WAY.' };
    expect(notificationText(raw, '/mijozlar')).toEqual({ title: 'Usta yo‘lga chiqdi', body: 'Usta sizning manzilingizga qarab yo‘lda.' });
    const words = { ...make('order.status_changed'), body: 'Buyurtma holati «Tasdiqlandi» dan «Usta yetib keldi» ga o‘zgardi.' };
    expect(notificationText(words, '/mijozlar').title).toBe('Usta yetib keldi');
  });

  it('addresses masters as masters', () => {
    const raw = { ...make('order.status_changed'), body: 'Buyurtma holati: WAITING_CONFIRMATION -> COMPLETED.' };
    expect(notificationText(raw, '/ustalar').title).toBe('Mijoz ishni tasdiqladi');
  });

  it('keeps freshly written notifications as they are', () => {
    const fresh = { ...make('order.status_changed'), title: 'Usta yetib keldi', body: 'Usta manzilingizga yetib keldi.' };
    expect(notificationText(fresh, '/mijozlar')).toEqual({ title: 'Usta yetib keldi', body: 'Usta manzilingizga yetib keldi.' });
    expect(notificationText({ ...make('chat.message'), body: 'Farux sizga xabar yubordi.' }, '/mijozlar').body).toBe('Farux sizga xabar yubordi.');
  });
});
