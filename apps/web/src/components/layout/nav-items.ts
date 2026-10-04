import {
  Activity,
  BadgeCheck,
  BarChart3,
  Bell,
  MessagesSquare,
  Blocks,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileText,
  Images,
  LayoutDashboard,
  MessageCircle,
  PackageCheck,
  PlusCircle,
  Scale,
  ScrollText,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Role } from '@/types/common';
import { t } from '@/i18n';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group: string;
  primary?: boolean;
  short?: string;
  /** Faqat shu huquqi bor admin (yoki superadmin) ko‘radi. */
  permission?: string;
}

const ACCOUNT = 'Akkaunt';

/** Menyu elementlari joriy tilda (yorliq, qisqa nom va guruh nomi tarjima qilinadi). */
export function getNavItems(role: Role | null, options: { superAdmin?: boolean; permissions?: string[] } = {}): NavItem[] {
  return rawNavItems(role, options).map((item) => ({ ...item, label: t(item.label), short: item.short ? t(item.short) : undefined, group: t(item.group) }));
}

function rawNavItems(role: Role | null, options: { superAdmin?: boolean; permissions?: string[] }): NavItem[] {
  if (role === 'ADMIN') {
    const allowed = (item: NavItem) => options.superAdmin || !item.permission || !!options.permissions?.includes(item.permission);
    return [
      { to: '/admin', label: t('Boshqaruv paneli'), short: t('Panel'), icon: LayoutDashboard, group: 'Umumiy', primary: true, permission: 'REPORTS' },
      { to: '/admin/hisobot', label: t('Hisobotlar'), short: t('Hisobot'), icon: BarChart3, group: 'Umumiy', primary: true, permission: 'REPORTS' },
      { to: '/admin/devops', label: 'DevOps', icon: Activity, group: 'Umumiy', permission: 'DEVOPS' },
      { to: '/admin/foydalanuvchilar', label: t('Foydalanuvchilar'), icon: Users, group: 'Boshqaruv', permission: 'USERS' },
      ...(options.superAdmin ? [{ to: '/admin/adminlar', label: t('Adminlar'), icon: UserCog, group: 'Boshqaruv' } satisfies NavItem] : []),
      { to: '/admin/buyurtmalar', label: t('Buyurtmalar'), icon: PackageCheck, group: 'Boshqaruv', permission: 'ORDERS' },
      { to: '/admin/suhbatlar', label: t('Suhbatlar'), icon: MessagesSquare, group: 'Boshqaruv', permission: 'CHATS' },
      { to: '/admin/xabarlar', label: t('Xabarlar'), icon: MessageCircle, group: 'Boshqaruv' },
      { to: '/admin/tasdiqlash', label: t('Ustalarni tasdiqlash'), short: t('Tasdiq'), icon: BadgeCheck, group: 'Boshqaruv', primary: true, permission: 'VERIFICATIONS' },
      { to: '/admin/shikoyatlar', label: t('Shikoyat va nizolar'), short: t('Nizolar'), icon: Scale, group: 'Boshqaruv', primary: true, permission: 'CASES' },
      { to: '/admin/xavfsizlik', label: t('Choralar va apellyatsiya'), icon: ShieldAlert, group: 'Boshqaruv', permission: 'SAFETY' },
      { to: '/admin/katalog', label: t('Xizmatlar katalogi'), icon: Blocks, group: 'Kontent', permission: 'CATALOG' },
      { to: '/admin/siyosatlar', label: t('Siyosatlar'), icon: FileText, group: 'Kontent', permission: 'POLICIES' },
      { to: '/admin/audit', label: t('Audit jurnali'), icon: ScrollText, group: 'Kontent', permission: 'AUDIT' },
      { to: '/bildirishnomalar', label: t('Bildirishnomalar'), icon: Bell, group: ACCOUNT },
      { to: '/sozlamalar', label: t('Sozlamalar'), icon: Settings, group: ACCOUNT },
    ].filter(allowed);
  }
  if (role === 'MASTER') {
    return [
      { to: '/ustalar/faol-takliflar', label: t('Faol takliflar'), short: t('Takliflar'), icon: BriefcaseBusiness, group: 'Ish', primary: true },
      { to: '/ustalar/takliflar', label: t('Kelgan so‘rovlar'), icon: Send, group: 'Ish' },
      { to: '/ustalar/mening-takliflarim', label: t('Takliflarim'), icon: FileCheck2, group: 'Ish' },
      { to: '/ustalar/buyurtmalar', label: t('Buyurtmalar'), icon: ClipboardList, group: 'Ish', primary: true },
      { to: '/ustalar/jadval', label: t('Ish jadvali'), icon: CalendarClock, group: 'Ish' },
      { to: '/ustalar/portfolio', label: t('Portfolio'), icon: Images, group: 'Ish' },
      { to: '/ustalar/daromad', label: t('Daromad'), icon: Wallet, group: 'Ish' },
      { to: '/ustalar/chat', label: t('Chat'), icon: MessageCircle, group: 'Muloqot', primary: true },
      { to: '/ustalar/kafolat', label: t('Kafolatlar'), icon: ShieldCheck, group: 'Muloqot' },
      { to: '/ustalar/nizolar', label: t('Nizolar'), icon: Scale, group: 'Muloqot' },
      { to: '/ustalar/profil', label: t('Profil'), icon: UserRound, group: ACCOUNT, primary: true },
      { to: '/xavfsizlik', label: t('Choralar va apellyatsiya'), icon: ShieldAlert, group: ACCOUNT },
      { to: '/huquqiy', label: t('Hujjatlar'), icon: FileText, group: ACCOUNT },
      { to: '/bildirishnomalar', label: t('Bildirishnomalar'), icon: Bell, group: ACCOUNT },
      { to: '/sozlamalar', label: t('Sozlamalar'), icon: Settings, group: ACCOUNT },
    ];
  }
  return [
    { to: '/mijozlar/buyurtmalar', label: t('Buyurtmalar'), icon: PackageCheck, group: 'Asosiy', primary: true },
    { to: '/mijozlar/sorov-yaratish', label: t('Yangi buyurtma'), short: t('Yangi'), icon: PlusCircle, group: 'Asosiy', primary: true },
    { to: '/mijozlar/tolovlar', label: t('To‘lovlar'), icon: CreditCard, group: 'Asosiy' },
    { to: '/ustalar-katalogi', label: t('Ustalar'), icon: Users, group: 'Asosiy' },
    { to: '/mijozlar/chat', label: t('Chat'), icon: MessageCircle, group: 'Muloqot', primary: true },
    { to: '/mijozlar/kafolat', label: t('Kafolatlar'), icon: ShieldCheck, group: 'Muloqot' },
    { to: '/mijozlar/shikoyatlar', label: t('Shikoyatlar'), icon: ShieldAlert, group: 'Muloqot' },
    { to: '/mijozlar/nizolar', label: t('Nizolar'), icon: Scale, group: 'Muloqot' },
    { to: '/mijozlar/profil', label: t('Profil'), icon: UserRound, group: ACCOUNT, primary: true },
    { to: '/xavfsizlik', label: t('Choralar va apellyatsiya'), icon: ShieldAlert, group: ACCOUNT },
    { to: '/huquqiy', label: t('Hujjatlar'), icon: FileText, group: ACCOUNT },
    { to: '/bildirishnomalar', label: t('Bildirishnomalar'), icon: Bell, group: ACCOUNT },
    { to: '/sozlamalar', label: t('Sozlamalar'), icon: Settings, group: ACCOUNT },
  ];
}
