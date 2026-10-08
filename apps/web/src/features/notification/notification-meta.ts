import { Banknote, BadgeCheck, Bell, CalendarCheck, CalendarClock, CheckCircle2, ClipboardCheck, ClipboardList, Handshake, Image, MapPin, MessageCircle, PhoneMissed, Crown, CreditCard, Package, Scale, ScrollText, Search, Send, Truck, Wrench, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { STATUS_TEXT } from '@/features/order/order-flow';
import type { AppNotification } from './types';
import { t } from '@/i18n';

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

/** Buyurtma holati bo‘yicha ikona va rang (eski bildirishnomalarda holat yo‘q — sarlavhadan aniqlanadi). */
const ORDER_STATUS_META: Record<string, { icon: LucideIcon; tone: NotificationTone }> = {
  CONFIRMED: { icon: Handshake, tone: 'success' },
  ON_THE_WAY: { icon: Truck, tone: 'primary' },
  ARRIVED: { icon: MapPin, tone: 'primary' },
  IN_PROGRESS: { icon: Wrench, tone: 'primary' },
  WAITING_CONFIRMATION: { icon: ClipboardCheck, tone: 'warning' },
  COMPLETED: { icon: CheckCircle2, tone: 'success' },
  CANCELLED: { icon: XCircle, tone: 'danger' },
  EXPIRED: { icon: XCircle, tone: 'danger' },
  DISPUTED: { icon: Scale, tone: 'warning' },
};
const TITLE_STATUS: Array<[string, string]> = [
  ['yo‘lga', 'ON_THE_WAY'],
  ['yetib', 'ARRIVED'],
  ['boshladi', 'IN_PROGRESS'],
  ['tugatdi', 'WAITING_CONFIRMATION'],
  ['yakunlandi', 'COMPLETED'],
  ['bekor', 'CANCELLED'],
  ['muddati tugadi', 'EXPIRED'],
  ['nizo', 'DISPUTED'],
  ['tasdiqladi', 'CONFIRMED'],
];
function orderStatusMeta(item: AppNotification, data: Record<string, unknown>) {
  const status = typeof data.status === 'string' ? data.status : TITLE_STATUS.find(([word]) => item.title.toLowerCase().includes(word))?.[1];
  return status ? ORDER_STATUS_META[status] : undefined;
}

export function notificationMeta(item: AppNotification, base: '/mijoz' | '/usta', admin = false): NotificationMeta {
  const data = item.data ?? {};
  switch (item.template) {
    case 'chat.message': {
      const id = typeof data.conversationId === 'string' ? data.conversationId : null;
      const chat = admin ? '/admin/xabarlar' : `${base}/chat`;
      return { icon: MessageCircle, tone: 'primary', to: id ? `${chat}?suhbat=${id}` : chat };
    }
    case 'subscription.activated':
      return { icon: Crown, tone: 'success', to: `${base}/obuna` };
    case 'subscription.reminder':
      return { icon: Crown, tone: 'warning', to: `${base}/obuna` };
    case 'subscription.expired':
    case 'subscription.rejected':
      return { icon: Crown, tone: 'danger', to: `${base}/obuna` };
    case 'call.missed': {
      const id = typeof data.conversationId === 'string' ? data.conversationId : null;
      return { icon: PhoneMissed, tone: 'danger', to: id ? `${base}/chat?suhbat=${id}` : `${base}/chat` };
    }
    case 'order.booked':
      return { icon: CalendarCheck, tone: 'success', to: orderPath(base, data.orderId) };
    case 'order.status_changed':
      return { ...(orderStatusMeta(item, data) ?? { icon: Package, tone: 'primary' as const }), to: orderPath(base, data.orderId) };
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
      return { icon: CreditCard, tone: 'success', to: base === '/mijoz' ? (typeof data.orderId === 'string' ? `/mijoz/buyurtmalar/${data.orderId}` : '/mijoz/tolovlar') : undefined };
    case 'payment.failed':
      return { icon: CreditCard, tone: 'danger', to: base === '/mijoz' ? (typeof data.orderId === 'string' ? `/mijoz/buyurtmalar/${data.orderId}/tolov` : '/mijoz/tolovlar') : undefined };
    case 'matching.wave':
      return { icon: Search, tone: 'warning', to: base === '/usta' ? '/usta/faol-takliflar' : undefined };
    case 'trust.review':
      return { icon: BadgeCheck, tone: data.decision === 'APPROVE' ? 'success' : 'warning', to: '/usta/profil' };
    case 'portfolio.reviewed':
      return { icon: Image, tone: data.status === 'REJECTED' ? 'danger' : 'success', to: '/usta/portfolio' };
    case 'admin.audit': {
      const action = typeof data.action === 'string' ? data.action : '';
      const tone: NotificationTone = /DELETED|REJECT|MISMATCH|SUSPENDED/.test(action) ? 'danger' : /APPROVE|REACTIVATED/.test(action) ? 'success' : /SUBMITTED|REGISTERED|CREATED/.test(action) ? 'primary' : 'warning';
      return { icon: ScrollText, tone, to: adminAuditPath(action, data.path) };
    }
    case 'offer.received':
      return { icon: Send, tone: 'success', to: typeof data.requestId === 'string' ? `/mijoz/sorovlar/${data.requestId}` : '/mijoz/buyurtmalar' };
    default:
      return item.template?.startsWith('request') ? { icon: ClipboardList, tone: 'primary' } : { icon: Bell, tone: 'neutral' };
  }
}

type Recipient = 'customer' | 'master';
const LEGACY: Record<Recipient, Record<string, { title: string; body: string }>> = {
  customer: {
    CONFIRMED: { title: t('Usta buyurtmani tasdiqladi'), body: t('Usta buyurtmangizni qabul qildi va tasdiqladi.') },
    ON_THE_WAY: { title: t('Usta yo‘lga chiqdi'), body: t('Usta sizning manzilingizga qarab yo‘lda.') },
    ARRIVED: { title: t('Usta yetib keldi'), body: t('Usta manzilingizga yetib keldi.') },
    IN_PROGRESS: { title: t('Usta ishni boshladi'), body: t('Buyurtmangiz bo‘yicha ish boshlandi.') },
    WAITING_CONFIRMATION: { title: t('Usta ishni tugatdi'), body: t('Ish bajarildi. Iltimos, natijani ko‘rib chiqib, tasdiqlang.') },
    COMPLETED: { title: t('Buyurtma yakunlandi'), body: t('Buyurtma yakunlandi.') },
    CANCELLED: { title: t('Buyurtma bekor qilindi'), body: t('Buyurtma bekor qilindi.') },
    EXPIRED: { title: t('Buyurtma muddati tugadi'), body: t('Usta belgilangan vaqtda tasdiqlamagani uchun buyurtma bekor bo‘ldi.') },
    DISPUTED: { title: t('Buyurtma bo‘yicha nizo ochildi'), body: t('Administrator nizoni ko‘rib chiqadi.') },
  },
  master: {
    COMPLETED: { title: t('Mijoz ishni tasdiqladi'), body: t('Buyurtma muvaffaqiyatli yakunlandi.') },
    CANCELLED: { title: t('Mijoz buyurtmani bekor qildi'), body: t('Mijoz buyurtmani bekor qildi.') },
    DISPUTED: { title: t('Mijoz nizo ochdi'), body: t('Buyurtma bo‘yicha nizo ochildi. Administrator ko‘rib chiqadi.') },
  },
};
const STATUS_BY_LABEL = Object.fromEntries(Object.entries(STATUS_TEXT).map(([code, label]) => [label, code]));

/**
 * Bildirishnomaning ko‘rinadigan sarlavha va matni. Yangilari serverda tayyor yoziladi; eski
 * («ON_THE_WAY -> ARRIVED», «... o‘zgardi») yozuvlar joriy holatni aytadigan jumlaga almashtiriladi.
 */
export function notificationText(item: AppNotification, base: '/mijoz' | '/usta'): { title: string; body: string } {
  if (item.template !== 'order.status_changed') return { title: item.title, body: item.body };
  const legacy = /->|→|o‘zgardi|o'zgardi/.test(item.body) || /o‘zgardi|o'zgardi/.test(item.title);
  if (!legacy) return { title: item.title, body: item.body };
  const mentioned = [...item.body.matchAll(/[A-Z]+(?:_[A-Z]+)+|\b[A-Z]{4,}\b|«([^»]+)»/g)].map((match) => (match[1] ? STATUS_BY_LABEL[match[1]] : match[0]));
  const newStatus = mentioned[mentioned.length - 1];
  const known = newStatus ? LEGACY[base === '/usta' ? 'master' : 'customer'][newStatus] : undefined;
  if (known) return known;
  const label = newStatus ? (STATUS_TEXT as Record<string, string>)[newStatus] : undefined;
  return label ? { title: t('Buyurtma yangilandi'), body: t('Buyurtmaning hozirgi holati: {label}.', { label }) } : { title: item.title, body: item.body };
}
