import { Banknote, BadgeCheck, Bell, CalendarCheck, CalendarClock, ClipboardList, Image, MessageCircle, CreditCard, Package, ScrollText, Search, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { STATUS_TEXT } from '@/features/order/order-flow';
import type { AppNotification } from './types';

export type NotificationTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export interface NotificationMeta {
  icon: LucideIcon;
  tone: NotificationTone;
  to?: string;
}

const orderPath = (base: string, orderId: unknown) => (typeof orderId === 'string' ? `${base}/buyurtmalar/${orderId}` : `${base}/buyurtmalar`);

/** Bildirishnoma turiga qarab ikona, rang va (mumkin bo‘lsa) o‘tiladigan sahifa. */
/** Admin audit bildirishnomasi turiga mos bo‘lim: bildirishnoma ochilmasa ham shu sahifaga kirilsa o‘qilgan bo‘ladi. */
export function adminAuditPath(action: string, fallback?: unknown): string {
  if (action.startsWith('VERIFICATION_') || action.startsWith('ADMIN_PORTFOLIO_') || action === 'MASTER_PROFILE_CREATED' || action === 'MASTER_PROFILE_UPDATED') return '/admin/tasdiqlash';
  if (action === 'AUTH_REGISTERED' || action === 'AUTH_REGISTRATION_VERIFIED' || action.startsWith('ADMIN_USER_')) return '/admin/foydalanuvchilar';
  if (action === 'USER_ACTION_CREATED' || action.startsWith('APPEAL_')) return '/admin/xavfsizlik';
  if (action.startsWith('DISPUTE_') || action.startsWith('COMPLAINT_') || action.startsWith('WARRANTY_CLAIM_') || action === 'ORDER_DISPUTED') return '/admin/shikoyatlar';
  if (action.startsWith('ADMIN_ORDER_') || action === 'PAYMENT_REFUNDED' || action === 'PAYMENT_WEBHOOK_MISMATCH') return '/admin/buyurtmalar';
  if (action.startsWith('CHAT_MESSAGE_')) return '/admin/suhbatlar';
  if (action.startsWith('SERVICE_')) return '/admin/katalog';
  return typeof fallback === 'string' ? fallback : '/admin/audit';
}

export function notificationMeta(item: AppNotification, base: '/mijozlar' | '/ustalar', admin = false): NotificationMeta {
  const data = item.data ?? {};
  switch (item.template) {
    case 'chat.message': {
      const id = typeof data.conversationId === 'string' ? data.conversationId : null;
      const chat = admin ? '/admin/xabarlar' : `${base}/chat`;
      return { icon: MessageCircle, tone: 'primary', to: id ? `${chat}?suhbat=${id}` : chat };
    }
    case 'order.booked':
      return { icon: CalendarCheck, tone: 'success', to: orderPath(base, data.orderId) };
    case 'order.status_changed':
      return { icon: Package, tone: 'primary', to: orderPath(base, data.orderId) };
    case 'order.reschedule_proposed':
      return { icon: CalendarClock, tone: 'warning', to: orderPath(base, data.orderId) };
    case 'order.reschedule_accepted':
      return { icon: CalendarClock, tone: 'success', to: orderPath(base, data.orderId) };
    case 'order.reschedule_declined':
      return { icon: CalendarClock, tone: 'danger', to: orderPath(base, data.orderId) };
    case 'order.reminder':
      return { icon: CalendarClock, tone: 'warning', to: orderPath(base, data.orderId) };
    case 'payment.method_chosen': {
      const cash = item.title.includes('naqd');
      return { icon: cash ? Banknote : CreditCard, tone: 'warning', to: typeof data.orderId === 'string' ? `${orderPath(base, data.orderId)}#tolov` : `${base}/buyurtmalar` };
    }
    case 'payment.received':
      return { icon: CreditCard, tone: 'success', to: typeof data.orderId === 'string' ? `${orderPath(base, data.orderId)}#tolov` : `${base}/buyurtmalar` };
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
      return { icon: ScrollText, tone, to: adminAuditPath(action, data.path) };
    }
    case 'offer.received':
      return { icon: Send, tone: 'success', to: typeof data.requestId === 'string' ? `/mijozlar/sorovlar/${data.requestId}` : '/mijozlar/buyurtmalar' };
    default:
      return item.template?.startsWith('request') ? { icon: ClipboardList, tone: 'primary' } : { icon: Bell, tone: 'neutral' };
  }
}

type Recipient = 'customer' | 'master';
const LEGACY: Record<Recipient, Record<string, { title: string; body: string }>> = {
  customer: {
    CONFIRMED: { title: 'Usta buyurtmani tasdiqladi', body: 'Usta buyurtmangizni qabul qildi va tasdiqladi.' },
    ON_THE_WAY: { title: 'Usta yo‘lga chiqdi', body: 'Usta sizning manzilingizga qarab yo‘lda.' },
    ARRIVED: { title: 'Usta yetib keldi', body: 'Usta manzilingizga yetib keldi.' },
    IN_PROGRESS: { title: 'Usta ishni boshladi', body: 'Buyurtmangiz bo‘yicha ish boshlandi.' },
    WAITING_CONFIRMATION: { title: 'Usta ishni tugatdi', body: 'Ish bajarildi. Iltimos, natijani ko‘rib chiqib, tasdiqlang.' },
    COMPLETED: { title: 'Buyurtma yakunlandi', body: 'Buyurtma yakunlandi.' },
    CANCELLED: { title: 'Buyurtma bekor qilindi', body: 'Buyurtma bekor qilindi.' },
    EXPIRED: { title: 'Buyurtma muddati tugadi', body: 'Usta belgilangan vaqtda tasdiqlamagani uchun buyurtma bekor bo‘ldi.' },
    DISPUTED: { title: 'Buyurtma bo‘yicha nizo ochildi', body: 'Administrator nizoni ko‘rib chiqadi.' },
  },
  master: {
    COMPLETED: { title: 'Mijoz ishni tasdiqladi', body: 'Buyurtma muvaffaqiyatli yakunlandi.' },
    CANCELLED: { title: 'Mijoz buyurtmani bekor qildi', body: 'Mijoz buyurtmani bekor qildi.' },
    DISPUTED: { title: 'Mijoz nizo ochdi', body: 'Buyurtma bo‘yicha nizo ochildi. Administrator ko‘rib chiqadi.' },
  },
};
const STATUS_BY_LABEL = Object.fromEntries(Object.entries(STATUS_TEXT).map(([code, label]) => [label, code]));

/**
 * Bildirishnomaning ko‘rinadigan sarlavha va matni. Yangilari serverda tayyor yoziladi; eski
 * («ON_THE_WAY -> ARRIVED», «... o‘zgardi») yozuvlar joriy holatni aytadigan jumlaga almashtiriladi.
 */
export function notificationText(item: AppNotification, base: '/mijozlar' | '/ustalar'): { title: string; body: string } {
  if (item.template !== 'order.status_changed') return { title: item.title, body: item.body };
  const legacy = /->|→|o‘zgardi|o'zgardi/.test(item.body) || /o‘zgardi|o'zgardi/.test(item.title);
  if (!legacy) return { title: item.title, body: item.body };
  const mentioned = [...item.body.matchAll(/[A-Z]+(?:_[A-Z]+)+|\b[A-Z]{4,}\b|«([^»]+)»/g)].map((match) => (match[1] ? STATUS_BY_LABEL[match[1]] : match[0]));
  const newStatus = mentioned[mentioned.length - 1];
  const known = newStatus ? LEGACY[base === '/ustalar' ? 'master' : 'customer'][newStatus] : undefined;
  if (known) return known;
  const label = newStatus ? (STATUS_TEXT as Record<string, string>)[newStatus] : undefined;
  return label ? { title: 'Buyurtma yangilandi', body: `Buyurtmaning hozirgi holati: ${label}.` } : { title: item.title, body: item.body };
}
