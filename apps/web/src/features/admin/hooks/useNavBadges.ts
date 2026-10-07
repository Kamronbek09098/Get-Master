import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNotifications, useUnreadCount } from '@/features/notification/hooks/useNotifications';
import { communicationService } from '@/features/communication/services/communication.service';
import { customerService } from '@/features/customer/services/customer.service';
import { adminService } from '../services/admin.service';

type SeenKey = 'audit' | 'users' | 'chats' | 'verifications' | 'cases' | 'appeals' | 'offers' | 'orders';
const STORAGE_PREFIX = 'gm.seen.';
/** Doimiy shovqin: har bir sessiya yangilanishi «yangi yozuv» hisoblanmasin. */
const NOISE = new Set(['AUTH_REFRESH_ROTATED']);
const listeners = new Set<() => void>();
const seen: Record<SeenKey, string | null> = { audit: null, users: null, chats: null, verifications: null, cases: null, appeals: null, offers: null, orders: null };

for (const key of Object.keys(seen) as SeenKey[]) {
  try {
    seen[key] = localStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    /* xotira yopiq bo‘lsa, faqat shu sessiya uchun */
  }
}

/** Adminning oxirgi ko‘rgan vaqti (server vaqti bilan solishtiriladi, soat farqi ta’sir qilmaydi). */
function markSeen(key: SeenKey, at: string) {
  if (seen[key] && seen[key]! >= at) return;
  seen[key] = at;
  try {
    localStorage.setItem(STORAGE_PREFIX + key, at);
  } catch {
    /* e’tiborsiz */
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const useSeen = (key: SeenKey) => useSyncExternalStore(subscribe, () => seen[key]);

export interface NavBadge {
  count: number;
  /** true bo‘lsa, ko‘rsatilgan son «kamida» (masalan, 30+). */
  capped: boolean;
}
export const badgeText = (badge: NavBadge) => (badge.capped ? `${badge.count}+` : String(badge.count));

/** Yo‘l → belgi. Faqat soni 0 dan katta bo‘lganlar qaytariladi. */
export function useNavBadges(role: string | null, pathname: string): Record<string, NavBadge> {
  const admin = role === 'ADMIN';
  const usersSeen = useSeen('users');
  const chatsSeen = useSeen('chats');
  const auditSeen = useSeen('audit');
  const verificationsSeen = useSeen('verifications');
  const casesSeen = useSeen('cases');
  const appealsSeen = useSeen('appeals');
  const ordersSeen = useSeen('orders');
  const onOrders = pathname.startsWith('/admin/buyurtmalar');
  const onUsers = pathname.startsWith('/admin/foydalanuvchilar');
  const onChats = pathname.startsWith('/admin/suhbatlar');
  const onAudit = pathname.startsWith('/admin/audit');
  const onVerifications = pathname.startsWith('/admin/tasdiqlash');
  const onCases = pathname.startsWith('/admin/shikoyatlar');
  const onAppeals = pathname.startsWith('/admin/xavfsizlik');

  const customer = role === 'CUSTOMER';
  const offersSeen = useSeen('offers');
  const onRequests = pathname.startsWith('/mijoz/buyurtmalar') || pathname.startsWith('/mijoz/sorovlar');
  // «Ko‘rilgan vaqt» so‘rov kalitiga kirmaydi: aks holda natija vaqtni yangilaydi → kalit o‘zgaradi → so‘rov qayta ketadi (cheksiz tsikl).
  const offersSeenRef = useRef(offersSeen);
  offersSeenRef.current = offersSeen;
  const offers = useQuery({
    queryKey: ['customer', 'badges'],
    queryFn: () => customerService.badges(offersSeenRef.current ?? undefined),
    enabled: customer,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
  const offersNow = offers.data?.now;
  useEffect(() => {
    if (offersNow && (!offersSeen || onRequests)) markSeen('offers', offersNow);
  }, [offersNow, offersSeen, onRequests]);

  const chatRole = role === 'MASTER' || role === 'CUSTOMER';
  const chatUnread = useQuery({
    queryKey: ['conversations', 'unread-count'],
    queryFn: () => communicationService.unreadCount(),
    enabled: chatRole,
    refetchInterval: 8_000,
    refetchOnWindowFocus: true,
  });

  const master = role === 'MASTER';
  const onMasterOrders = pathname.startsWith('/usta/buyurtmalar');
  // Buyurtma holati o'zgarganda (usta yetib keldi, ishni tugatdi va h.k.) "Buyurtmalar" bo'limida ham belgi yonsin.
  const orderNotifications = useNotifications(customer || master);
  const orderNotifUnread = (orderNotifications.data?.items ?? []).filter(
    (item) => !item.readAt && (item.template === 'order.booked' || item.template === 'order.status_changed'),
  ).length;

  const unread = useUnreadCount();
  const adminSeenRef = useRef({ usersSeen, chatsSeen, verificationsSeen, casesSeen, appealsSeen, ordersSeen });
  adminSeenRef.current = { usersSeen, chatsSeen, verificationsSeen, casesSeen, appealsSeen, ordersSeen };
  const badges = useQuery({
    queryKey: ['admin', 'badges'],
    queryFn: () => {
      const v = adminSeenRef.current;
      return adminService.badges({
        usersSince: v.usersSeen ?? undefined,
        chatsSince: v.chatsSeen ?? undefined,
        verificationsSince: v.verificationsSeen ?? undefined,
        casesSince: v.casesSeen ?? undefined,
        appealsSince: v.appealsSeen ?? undefined,
        ordersSince: v.ordersSeen ?? undefined,
      });
    },
    enabled: admin,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const audit = useQuery({
    queryKey: ['admin', 'audit-latest'],
    queryFn: () => adminService.audit({}),
    enabled: admin,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const now = badges.data?.now;
  const auditItems = audit.data?.items ?? [];
  const auditNewest = auditItems[0]?.createdAt;

  // Birinchi ochilganda eski ma’lumotlar «yangi» bo‘lib chiqmasin; sahifada turganda kelganlari darhol ko‘rilgan hisoblanadi.
  useEffect(() => {
    if (!now) return;
    if (!usersSeen || onUsers) markSeen('users', now);
    if (!chatsSeen || onChats) markSeen('chats', now);
    if (!verificationsSeen || onVerifications) markSeen('verifications', now);
    if (!casesSeen || onCases) markSeen('cases', now);
    if (!appealsSeen || onAppeals) markSeen('appeals', now);
    if (!ordersSeen || onOrders) markSeen('orders', now);
  }, [now, usersSeen, chatsSeen, verificationsSeen, casesSeen, appealsSeen, ordersSeen, onUsers, onChats, onVerifications, onCases, onAppeals, onOrders]);
  useEffect(() => {
    if (auditNewest && (!auditSeen || onAudit)) markSeen('audit', auditNewest);
  }, [auditNewest, auditSeen, onAudit]);

  const result: Record<string, NavBadge> = {};
  const put = (to: string, count: number, capped = false) => {
    if (count > 0) result[to] = { count, capped };
  };

  put('/bildirishnomalar', unread.data?.count ?? 0);
  if (chatRole) put(role === 'MASTER' ? '/usta/chat' : '/mijoz/chat', chatUnread.data?.count ?? 0);
  if (customer) put('/mijoz/buyurtmalar', onRequests ? 0 : (offers.data?.offers ?? 0) + orderNotifUnread);
  if (master) put('/usta/buyurtmalar', onMasterOrders ? 0 : orderNotifUnread);
  if (admin) {
    const data = badges.data;
    put('/admin/tasdiqlash', onVerifications ? 0 : (data?.verifications ?? 0));
    put('/admin/shikoyatlar', onCases ? 0 : (data?.cases ?? 0));
    put('/admin/buyurtmalar', onOrders ? 0 : (data?.orders ?? 0));
    put('/admin/xavfsizlik', onAppeals ? 0 : (data?.appeals ?? 0));
    put('/admin/foydalanuvchilar', onUsers ? 0 : (data?.users ?? 0));
    put('/admin/suhbatlar', onChats ? 0 : (data?.chats ?? 0));
    const fresh = auditSeen ? auditItems.filter((log) => !NOISE.has(log.action) && log.createdAt > auditSeen) : [];
    put('/admin/audit', onAudit ? 0 : fresh.length, fresh.length === auditItems.length && !!audit.data?.nextCursor);
  }
  return result;
}
