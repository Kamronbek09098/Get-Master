import {
  Armchair,
  BadgeCheck,
  CalendarClock,
  Camera,
  ClipboardCheck,
  Clock,
  Coins,
  Lock,
  Droplets,
  Hammer,
  Handshake,
  KeyRound,
  Mic,
  Search,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  Type,
  UserPlus,
  Video,
  Wallet,
  WashingMachine,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { t } from '@/i18n';

export interface Step {
  icon: LucideIcon;
  title: string;
  text: string;
}

export interface LandingContent {
  eyebrow: string;
  title: string;
  highlight: string;
  lead: string;
  primaryCta: string;
  secondaryCta: string;
  stats: Array<{ value: string; label: string; icon: LucideIcon; note?: string }>;
  statementLabel: string;
  statement: string;
  stepsTitle: string;
  steps: Step[];
  showCategories: boolean;
  trustTitle: string;
  trust: Step[];
  ctaTitle: string;
  ctaText: string;
}

export const CATEGORIES: Array<{ icon: LucideIcon; name: string }> = [
  { icon: Droplets, name: 'Santexnika' },
  { icon: Zap, name: 'Elektr' },
  { icon: Snowflake, name: 'Konditsioner' },
  { icon: WashingMachine, name: 'Maishiy texnika' },
  { icon: Hammer, name: t('Ta’mirlash') },
  { icon: Sparkles, name: 'Tozalash' },
  { icon: Armchair, name: 'Mebel' },
  { icon: KeyRound, name: 'Eshik va qulflar' },
];

export const INPUT_METHODS: Array<{ icon: LucideIcon; label: string }> = [
  { icon: Type, label: t('Matn') },
  { icon: Camera, label: t('Foto') },
  { icon: Video, label: t('Video') },
  { icon: Mic, label: t('Ovoz') },
];

export const CUSTOMER_CONTENT: LandingContent = {
  eyebrow: t('Uy va xonadon xizmatlari'),
  title: t('Muammo bormi?'),
  highlight: 'Mos ustani topamiz',
  lead: t('Muammoni matn, foto, video yoki ovoz bilan tasvirlab bering — tasdiqlangan ustalar taklif yuboradi. Narxni solishtiring, eng yaxshisini tanlang.'),
  primaryCta: t('So‘rov yaratish'),
  secondaryCta: t('Qanday ishlaydi'),
  stats: [
    { value: '24/7', label: t('So‘rov qabul qilish'), icon: Clock },
    { value: '100%', label: t('Tasdiqlangan ustalar'), icon: BadgeCheck },
    { value: 'Kafolat', label: t('Har bir ishga'), icon: ShieldCheck },
    { value: 'Xavfsiz', label: t('Onlayn to‘lov'), icon: Lock },
  ],
  statementLabel: t('(01) Biz haqimizda'),
  statement: t('Har kuni biror narsa buziladi. Biz bu muammoni hal qiladigan tasdiqlangan ustani — narxi aniq, ishi kafolatli — daqiqalar ichida topib beramiz.'),
  stepsTitle: t('To‘rt qadamda hal bo‘ladi'),
  steps: [
    { icon: Type, title: t('Muammoni tasvirlang'), text: t('Nima buzilganini yozing, rasmga oling yoki ovoz yozing. AI kategoriyani o‘zi aniqlaydi.') },
    { icon: Search, title: t('Takliflar oling'), text: t('Yaqin atrofdagi mos ustalar narx va vaqt bilan taklif yuboradi.') },
    { icon: Handshake, title: t('Ustani tanlang'), text: t('Reyting, sharh va tajribani ko‘ring. Bir tugma bilan bron qiling.') },
    { icon: ShieldCheck, title: t('Ish isboti va kafolat'), text: t('Usta ish oldidan va keyin suratga oladi. Tasdiqlagach to‘lov o‘tadi, kafolat boshlanadi.') },
  ],
  showCategories: true,
  trustTitle: t('Nega GetMaster ishonchli'),
  trust: [
    { icon: BadgeCheck, title: t('Tasdiqlangan ustalar'), text: t('Har bir usta shaxsini tasdiqlovchi hujjat bilan tekshiriladi.') },
    { icon: Camera, title: t('Ish isboti'), text: t('Oldin va keyin suratlar — nizo chiqsa, dalil tayyor.') },
    { icon: Star, title: t('Haqiqiy sharhlar'), text: t('Faqat ish tugagandan keyin haqiqiy mijoz baho qoldira oladi.') },
  ],
  ctaTitle: t('Birinchi so‘rovingizni hoziroq yarating'),
  ctaText: t('Ro‘yxatdan o‘tish bir daqiqa oladi va bepul.'),
};

export const MASTER_CONTENT: LandingContent = {
  eyebrow: t('Ustalar uchun'),
  title: t('Mijozlarni izlamang,'),
  highlight: 'ular sizni topadi',
  lead: t('Profilingizni yarating, tasdiqlating — yaqin atrofdagi so‘rovlar o‘zi keladi. Narxni o‘zingiz belgilang, daromadingizni kuzatib boring.'),
  primaryCta: t('Usta sifatida boshlash'),
  secondaryCta: t('Qanday ishlaydi'),
  stats: [
    { value: '0 so‘m', label: t('Ro‘yxatdan o‘tish'), icon: Coins, note: t('1 daqiqa') },
    { value: 'O‘zingiz', label: t('Narxni belgilaysiz'), icon: Tag },
    { value: 'Shaffof', label: t('Daromad va to‘lovlar'), icon: TrendingUp },
    { value: 'Erkin', label: t('Ish jadvali'), icon: CalendarClock },
  ],
  statementLabel: t('(01) Ustalar uchun'),
  statement: t('Mijoz izlash — ish emas. Profilingizni yarating, narxni o‘zingiz belgilang, yaqin atrofdagi so‘rovlar o‘zi sizni topadi va daromad shaffof bo‘ladi.'),
  stepsTitle: t('Ishni boshlash — 4 qadam'),
  steps: [
    { icon: UserPlus, title: t('Ro‘yxatdan o‘ting'), text: t('Telefon raqami bilan akkaunt oching va usta profilingizni to‘ldiring.') },
    { icon: BadgeCheck, title: t('Tasdiqlating'), text: t('Shaxsingizni tasdiqlovchi hujjatni yuboring — ishonch belgisi oling.') },
    { icon: ClipboardCheck, title: t('So‘rovlarga taklif bering'), text: t('Xizmat turingizga mos so‘rovlar keladi. Narx va vaqtni o‘zingiz yozing.') },
    { icon: Wallet, title: t('Ishlab toping'), text: t('Ishni bajaring, suratga oling — to‘lov hisobingizga tushadi.') },
  ],
  showCategories: false,
  trustTitle: t('Ustalar nimaga GetMaster’ni tanlaydi'),
  trust: [
    { icon: TrendingUp, title: t('Doimiy buyurtmalar'), text: t('Mijozlar oqimi tayyor: reklama va izlash uchun vaqt sarflamaysiz.') },
    { icon: ShieldCheck, title: t('Himoyalangan to‘lov'), text: t('Pul platforma orqali o‘tadi — ish tugagach kafolatli olasiz.') },
    { icon: Star, title: t('Obro‘ qurasiz'), text: t('Har bir yaxshi ish reyting va sharhga aylanadi, portfolio to‘planadi.') },
  ],
  ctaTitle: t('Bugunoq profil yarating'),
  ctaText: t('Tasdiqlangan ustalar ko‘proq buyurtma oladi.'),
};
