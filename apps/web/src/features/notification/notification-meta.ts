import { BadgeCheck, Bell, CalendarCheck, ClipboardList, Image, MessageCircle, CreditCard, Package, ScrollText, Search, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppNotification } from './types';

export type NotificationTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export interface NotificationMeta {
  icon: LucideIcon;
  tone: NotificationTone;
  to?: string;
}

const orderPath = (base: string, orderId: unknown) => (typeof orderId === 'string' ? `${base}/buyurtmalar/${orderId}` : `${base}/buyurtmalar`);

/** Bildirishnoma turiga qarab ikona, rang va (mumkin bo‘lsa) o‘tiladigan sahifa. */
export function notificationMeta(item: AppNotification, base: '/mijozlar' | '/ustalar'): NotificationMeta {
  const data = item.data ?? {};
  switch (item.template) {
    case 'chat.message': {
      const id = typeof data.conversationId === 'string' ? data.conversationId : null;
      return { icon: MessageCircle, tone: 'primary', to: id ? `${base}/chat?suhbat=${id}` : `${base}/chat` };
    }
    case 'order.booked':
      return { icon: CalendarCheck, tone: 'success', to: orderPath(base, data.orderId) };
    case 'order.status_changed':
      return { icon: Package, tone: 'primary', to: orderPath(base, data.orderId) };
    case 'payment.succeeded':
      return { icon: CreditCard, tone: 'success', to: base === '/mijozlar' ? (typeof data.orderId === 'string' ? `/mijozlar/buyurtmalar/${data.orderId}` : '/mijozlar/tolovlar') : undefined };
    case 'payment.failed':
      return { icon: CreditCard, tone: 'danger', to: base === '/mijozlar' ? (typeof data.orderId === 'string' ? `/mijozlar/buyurtmalar/${data.orderId}/tolov` : '/mijozlar/tolovlar') : undefined };
    case 'matching.wave':
      return { icon: Search, tone: 'warning', to: base === '/ustalar' ? '/ustalar/faol-takliflar' : undefined };
    case 'trust.review':
      return { icon: BadgeCheck, tone: data.decision === 'APPROVE' ? 'success' : 'warning', to: '/ustalar/profil' };
    case 'portfolio.reviewed':
      return { icon: Image, tone: data.status === 'REJECTED' ? 'danger' : 'success', to: '/ustalar/portfolio' };
    case 'admin.audit': {
      const action = typeof data.action === 'string' ? data.action : '';
      const tone: NotificationTone = /DELETED|REJECT|MISMATCH|SUSPENDED/.test(action) ? 'danger' : /APPROVE|REACTIVATED/.test(action) ? 'success' : /SUBMITTED|REGISTERED|CREATED/.test(action) ? 'primary' : 'warning';
      return { icon: ScrollText, tone, to: typeof data.path === 'string' ? data.path : '/admin/audit' };
    }
    case 'offer.received':
      return { icon: Send, tone: 'success', to: typeof data.requestId === 'string' ? `/mijozlar/sorovlar/${data.requestId}` : '/mijozlar/sorovlar' };
    default:
      return item.template?.startsWith('request') ? { icon: ClipboardList, tone: 'primary' } : { icon: Bell, tone: 'neutral' };
  }
}
