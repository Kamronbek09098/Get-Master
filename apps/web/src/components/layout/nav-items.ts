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
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Role } from '@/types/common';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group: string;
  primary?: boolean;
  short?: string;
}

const ACCOUNT = 'Akkaunt';

export function getNavItems(role: Role | null): NavItem[] {
  if (role === 'ADMIN') {
    return [
      { to: '/admin', label: 'Boshqaruv paneli', short: 'Panel', icon: LayoutDashboard, group: 'Umumiy', primary: true },
      { to: '/admin/hisobot', label: 'Hisobotlar', short: 'Hisobot', icon: BarChart3, group: 'Umumiy', primary: true },
      { to: '/admin/devops', label: 'DevOps', icon: Activity, group: 'Umumiy' },
      { to: '/admin/foydalanuvchilar', label: 'Foydalanuvchilar', icon: Users, group: 'Boshqaruv' },
      { to: '/admin/buyurtmalar', label: 'Buyurtmalar', icon: PackageCheck, group: 'Boshqaruv' },
      { to: '/admin/suhbatlar', label: 'Suhbatlar', icon: MessagesSquare, group: 'Boshqaruv' },
      { to: '/admin/xabarlar', label: 'Xabarlar', icon: MessageCircle, group: 'Boshqaruv' },
      { to: '/admin/tasdiqlash', label: 'Ustalarni tasdiqlash', short: 'Tasdiq', icon: BadgeCheck, group: 'Boshqaruv', primary: true },
      { to: '/admin/shikoyatlar', label: 'Shikoyat va nizolar', short: 'Nizolar', icon: Scale, group: 'Boshqaruv', primary: true },
      { to: '/admin/xavfsizlik', label: 'Choralar va apellyatsiya', icon: ShieldAlert, group: 'Boshqaruv' },
      { to: '/admin/katalog', label: 'Xizmatlar katalogi', icon: Blocks, group: 'Kontent' },
      { to: '/admin/siyosatlar', label: 'Siyosatlar', icon: FileText, group: 'Kontent' },
      { to: '/admin/audit', label: 'Audit jurnali', icon: ScrollText, group: 'Kontent' },
      { to: '/bildirishnomalar', label: 'Bildirishnomalar', icon: Bell, group: ACCOUNT },
      { to: '/sozlamalar', label: 'Sozlamalar', icon: Settings, group: ACCOUNT },
    ];
  }
  if (role === 'MASTER') {
    return [
      { to: '/ustalar/faol-takliflar', label: 'Faol takliflar', short: 'Takliflar', icon: BriefcaseBusiness, group: 'Ish', primary: true },
      { to: '/ustalar/takliflar', label: 'Kelgan so‘rovlar', icon: Send, group: 'Ish' },
      { to: '/ustalar/mening-takliflarim', label: 'Takliflarim', icon: FileCheck2, group: 'Ish' },
      { to: '/ustalar/buyurtmalar', label: 'Buyurtmalar', icon: ClipboardList, group: 'Ish', primary: true },
      { to: '/ustalar/jadval', label: 'Ish jadvali', icon: CalendarClock, group: 'Ish' },
      { to: '/ustalar/portfolio', label: 'Portfolio', icon: Images, group: 'Ish' },
      { to: '/ustalar/daromad', label: 'Daromad', icon: Wallet, group: 'Ish' },
      { to: '/ustalar/chat', label: 'Chat', icon: MessageCircle, group: 'Muloqot', primary: true },
      { to: '/ustalar/kafolat', label: 'Kafolatlar', icon: ShieldCheck, group: 'Muloqot' },
      { to: '/ustalar/nizolar', label: 'Nizolar', icon: Scale, group: 'Muloqot' },
      { to: '/ustalar/profil', label: 'Profil', icon: UserRound, group: ACCOUNT, primary: true },
      { to: '/xavfsizlik', label: 'Choralar va apellyatsiya', icon: ShieldAlert, group: ACCOUNT },
      { to: '/huquqiy', label: 'Hujjatlar', icon: FileText, group: ACCOUNT },
      { to: '/bildirishnomalar', label: 'Bildirishnomalar', icon: Bell, group: ACCOUNT },
      { to: '/sozlamalar', label: 'Sozlamalar', icon: Settings, group: ACCOUNT },
    ];
  }
  return [
    { to: '/mijozlar/buyurtmalar', label: 'Buyurtmalar', icon: PackageCheck, group: 'Asosiy', primary: true },
    { to: '/mijozlar/sorov-yaratish', label: 'Yangi buyurtma', short: 'Yangi', icon: PlusCircle, group: 'Asosiy', primary: true },
    { to: '/mijozlar/tolovlar', label: 'To‘lovlar', icon: CreditCard, group: 'Asosiy' },
    { to: '/ustalar-katalogi', label: 'Ustalar', icon: Users, group: 'Asosiy' },
    { to: '/mijozlar/chat', label: 'Chat', icon: MessageCircle, group: 'Muloqot', primary: true },
    { to: '/mijozlar/kafolat', label: 'Kafolatlar', icon: ShieldCheck, group: 'Muloqot' },
    { to: '/mijozlar/shikoyatlar', label: 'Shikoyatlar', icon: ShieldAlert, group: 'Muloqot' },
    { to: '/mijozlar/nizolar', label: 'Nizolar', icon: Scale, group: 'Muloqot' },
    { to: '/mijozlar/profil', label: 'Profil', icon: UserRound, group: ACCOUNT },
    { to: '/xavfsizlik', label: 'Choralar va apellyatsiya', icon: ShieldAlert, group: ACCOUNT },
    { to: '/huquqiy', label: 'Hujjatlar', icon: FileText, group: ACCOUNT },
    { to: '/bildirishnomalar', label: 'Bildirishnomalar', icon: Bell, group: ACCOUNT },
    { to: '/sozlamalar', label: 'Sozlamalar', icon: Settings, group: ACCOUNT },
  ];
}
