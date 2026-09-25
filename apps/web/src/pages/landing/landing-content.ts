import {
  Armchair,
  BadgeCheck,
  Camera,
  ClipboardCheck,
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
  TrendingUp,
  Type,
  UserPlus,
  Video,
  Wallet,
  WashingMachine,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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
  stats: Array<{ value: string; label: string }>;
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
  { icon: Hammer, name: 'Ta’mirlash' },
  { icon: Sparkles, name: 'Tozalash' },
  { icon: Armchair, name: 'Mebel' },
  { icon: KeyRound, name: 'Eshik va qulflar' },
];

export const INPUT_METHODS: Array<{ icon: LucideIcon; label: string }> = [
  { icon: Type, label: 'Matn' },
  { icon: Camera, label: 'Foto' },
  { icon: Video, label: 'Video' },
  { icon: Mic, label: 'Ovoz' },
];

export const CUSTOMER_CONTENT: LandingContent = {
  eyebrow: 'Uy va xonadon xizmatlari',
  title: 'Muammo bormi?',
  highlight: 'Mos ustani topamiz',
  lead: 'Muammoni matn, foto, video yoki ovoz bilan tasvirlab bering — tasdiqlangan ustalar taklif yuboradi. Narxni solishtiring, eng yaxshisini tanlang.',
  primaryCta: 'So‘rov yaratish',
  secondaryCta: 'Qanday ishlaydi',
  stats: [
    { value: '24/7', label: 'So‘rov qabul qilish' },
    { value: '100%', label: 'Tasdiqlangan ustalar' },
    { value: 'Kafolat', label: 'Har bir ishga' },
    { value: 'Xavfsiz', label: 'Onlayn to‘lov' },
  ],
  stepsTitle: 'To‘rt qadamda hal bo‘ladi',
  steps: [
    { icon: Type, title: 'Muammoni tasvirlang', text: 'Nima buzilganini yozing, rasmga oling yoki ovoz yozing. AI kategoriyani o‘zi aniqlaydi.' },
    { icon: Search, title: 'Takliflar oling', text: 'Yaqin atrofdagi mos ustalar narx va vaqt bilan taklif yuboradi.' },
    { icon: Handshake, title: 'Ustani tanlang', text: 'Reyting, sharh va tajribani ko‘ring. Bir tugma bilan bron qiling.' },
    { icon: ShieldCheck, title: 'Ish isboti va kafolat', text: 'Usta ish oldidan va keyin suratga oladi. Tasdiqlagach to‘lov o‘tadi, kafolat boshlanadi.' },
  ],
  showCategories: true,
  trustTitle: 'Nega GetMaster ishonchli',
  trust: [
    { icon: BadgeCheck, title: 'Tasdiqlangan ustalar', text: 'Har bir usta shaxsini tasdiqlovchi hujjat bilan tekshiriladi.' },
    { icon: Camera, title: 'Ish isboti', text: 'Oldin va keyin suratlar — nizo chiqsa, dalil tayyor.' },
    { icon: Star, title: 'Haqiqiy sharhlar', text: 'Faqat ish tugagandan keyin haqiqiy mijoz baho qoldira oladi.' },
  ],
  ctaTitle: 'Birinchi so‘rovingizni hoziroq yarating',
  ctaText: 'Ro‘yxatdan o‘tish bir daqiqa oladi va bepul.',
};

export const MASTER_CONTENT: LandingContent = {
  eyebrow: 'Ustalar uchun',
  title: 'Mijozlarni izlamang,',
  highlight: 'ular sizni topadi',
  lead: 'Profilingizni yarating, tasdiqlating — yaqin atrofdagi so‘rovlar o‘zi keladi. Narxni o‘zingiz belgilang, daromadingizni kuzatib boring.',
  primaryCta: 'Usta sifatida boshlash',
  secondaryCta: 'Qanday ishlaydi',
  stats: [
    { value: '0 so‘m', label: 'Ro‘yxatdan o‘tish' },
    { value: 'O‘zingiz', label: 'Narxni belgilaysiz' },
    { value: 'Shaffof', label: 'Daromad va to‘lovlar' },
    { value: 'Erkin', label: 'Ish jadvali' },
  ],
  stepsTitle: 'Ishni boshlash — 4 qadam',
  steps: [
    { icon: UserPlus, title: 'Ro‘yxatdan o‘ting', text: 'Telefon raqami bilan akkaunt oching va usta profilingizni to‘ldiring.' },
    { icon: BadgeCheck, title: 'Tasdiqlating', text: 'Shaxsingizni tasdiqlovchi hujjatni yuboring — ishonch belgisi oling.' },
    { icon: ClipboardCheck, title: 'So‘rovlarga taklif bering', text: 'Xizmat turingizga mos so‘rovlar keladi. Narx va vaqtni o‘zingiz yozing.' },
    { icon: Wallet, title: 'Ishlab toping', text: 'Ishni bajaring, suratga oling — to‘lov hisobingizga tushadi.' },
  ],
  showCategories: false,
  trustTitle: 'Ustalar nimaga GetMaster’ni tanlaydi',
  trust: [
    { icon: TrendingUp, title: 'Doimiy buyurtmalar', text: 'Mijozlar oqimi tayyor: reklama va izlash uchun vaqt sarflamaysiz.' },
    { icon: ShieldCheck, title: 'Himoyalangan to‘lov', text: 'Pul platforma orqali o‘tadi — ish tugagach kafolatli olasiz.' },
    { icon: Star, title: 'Obro‘ qurasiz', text: 'Har bir yaxshi ish reyting va sharhga aylanadi, portfolio to‘planadi.' },
  ],
  ctaTitle: 'Bugunoq profil yarating',
  ctaText: 'Tasdiqlangan ustalar ko‘proq buyurtma oladi.',
};
