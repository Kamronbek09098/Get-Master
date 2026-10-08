import { PolicyStatus, PolicyType, PrismaClient, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const POLICIES: Array<{ id: string; type: PolicyType; version: string; title: string; content: string }> = [
  {
    id: '00000000-0001-4000-8000-000000000001',
    type: PolicyType.TERMS,
    version: '1.0',
    title: 'Foydalanish shartlari',
    content: 'GetMaster platformasidan foydalanish shartlari',
  },
  {
    id: '00000000-0001-4000-8000-000000000002',
    type: PolicyType.PRIVACY,
    version: '1.0',
    title: 'Maxfiylik siyosati',
    content: 'GetMaster maxfiylik siyosati',
  },
  {
    id: '00000000-0001-4000-8000-000000000003',
    type: PolicyType.PLATFORM_RULES,
    version: '1.0',
    title: 'Platforma qoidalari',

    content: 'GetMaster platforma ishlatish qoidalari',
  },
];

interface SeedService {
  id: string;
  name: string;
  slug: string;
}

interface SeedCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  /** Xizmat rejimlari: mijoz manzilida / ustaning joyida. */
  modes?: Array<'AT_CUSTOMER' | 'AT_MASTER'>;
  services: SeedService[];
}

const CATEGORIES: SeedCategory[] = [
  {
    id: '00000000-0002-4000-8000-000000000001',
    name: 'Santexnika',
    slug: 'santexnika',
    sortOrder: 1,
    services: [
      { id: '00000000-0003-4000-8000-000000000001', name: 'Kran va armatura ta’miri', slug: 'kran-armatura-tamiri' },
      { id: '00000000-0003-4000-8000-000000000002', name: 'Quvur almashtirish', slug: 'quvur-almashtirish' },
      { id: '00000000-0003-4000-8000-000000000003', name: 'Unitaz va vanna o’rnatish', slug: 'unitaz-vanna-ornatish' },
    ],
  },
  {
    id: '00000000-0002-4000-8000-000000000002',
    name: 'Elektrika',
    slug: 'elektrika',
    sortOrder: 2,
    services: [
      { id: '00000000-0003-4000-8000-000000000004', name: 'Rozetka va o’chirgich o’rnatish', slug: 'rozetka-ochirgich-ornatish' },
      { id: '00000000-0003-4000-8000-000000000005', name: 'Elektr simlarini almashtirish', slug: 'elektr-simlarini-almashtirish' },
      { id: '00000000-0003-4000-8000-000000000006', name: 'Yoritgich o’rnatish', slug: 'yoritgich-ornatish' },
    ],
  },
  {
    id: '00000000-0002-4000-8000-000000000003',
    name: 'Mebel yig’ish',
    slug: 'mebel-yigish',
    sortOrder: 3,
    services: [
      { id: '00000000-0003-4000-8000-000000000007', name: 'Shkaf yig’ish', slug: 'shkaf-yigish' },
      { id: '00000000-0003-4000-8000-000000000008', name: 'Oshxona mebeli yig’ish', slug: 'oshxona-mebeli-yigish' },
    ],
  },
  {
    id: '00000000-0002-4000-8000-000000000004',
    name: 'Konditsioner xizmati',
    slug: 'konditsioner-xizmati',
    sortOrder: 4,
    services: [
      { id: '00000000-0003-4000-8000-000000000009', name: 'Konditsioner o’rnatish', slug: 'konditsioner-ornatish' },
      { id: '00000000-0003-4000-8000-00000000000a', name: 'Konditsioner tozalash/tuzatish', slug: 'konditsioner-tozalash-tuzatish' },
    ],
  },
  {
    id: '00000000-0002-4000-8000-000000000005',
    name: 'Tozalash xizmati',
    slug: 'tozalash-xizmati',
    sortOrder: 5,
    services: [
      { id: '00000000-0003-4000-8000-00000000000b', name: 'Uy tozalash', slug: 'uy-tozalash' },
      { id: '00000000-0003-4000-8000-00000000000c', name: 'Ta’mirdan keyingi tozalash', slug: 'tamirdan-keyingi-tozalash' },
    ],
  },
  {
    id: '00000000-0002-4000-8000-000000000011',
    name: 'Sartaroshxona va go‘zallik',
    slug: 'sartaroshxona-gozallik',
    sortOrder: 10,
    modes: ['AT_CUSTOMER', 'AT_MASTER'],
    services: [
      { id: '00000000-0003-4000-8000-000000000021', name: 'Erkaklar soch turmagi', slug: 'sartaroshxona-gozallik-erkaklar-soch-turmagi' },
      { id: '00000000-0003-4000-8000-000000000022', name: 'Ayollar soch turmagi', slug: 'sartaroshxona-gozallik-ayollar-soch-turmagi' },
      { id: '00000000-0003-4000-8000-000000000023', name: 'Soqol va mo‘ylov', slug: 'sartaroshxona-gozallik-soqol-va-moylov' },
      { id: '00000000-0003-4000-8000-000000000024', name: 'Manikyur va pedikyur', slug: 'sartaroshxona-gozallik-manikyur-va-pedikyur' },
      { id: '00000000-0003-4000-8000-000000000025', name: 'Makiyaj', slug: 'sartaroshxona-gozallik-makiyaj' },
      { id: '00000000-0003-4000-8000-000000000026', name: 'Qosh va kiprik', slug: 'sartaroshxona-gozallik-qosh-va-kiprik' },
      { id: '00000000-0003-4000-8000-000000000027', name: 'Massaj', slug: 'sartaroshxona-gozallik-massaj' },
    ],
  },
  {
    id: '00000000-0002-4000-8000-000000000012',
    name: 'Avtoservis',
    slug: 'avtoservis',
    sortOrder: 11,
    modes: ['AT_MASTER', 'AT_CUSTOMER'],
    services: [
      { id: '00000000-0003-4000-8000-000000000028', name: 'Avto diagnostika', slug: 'avtoservis-avto-diagnostika' },
      { id: '00000000-0003-4000-8000-000000000029', name: 'Dvigatel ta’miri', slug: 'avtoservis-dvigatel-tamiri' },
      { id: '00000000-0003-4000-8000-00000000002a', name: 'Yurish qismi ta’miri', slug: 'avtoservis-yurish-qismi-tamiri' },
      { id: '00000000-0003-4000-8000-00000000002b', name: 'Avto elektrika', slug: 'avtoservis-avto-elektrika' },
      { id: '00000000-0003-4000-8000-00000000002c', name: 'Shina almashtirish', slug: 'avtoservis-shina-almashtirish' },
      { id: '00000000-0003-4000-8000-00000000002d', name: 'Avtomobil yuvish', slug: 'avtoservis-avtomobil-yuvish' },
      { id: '00000000-0003-4000-8000-00000000002e', name: 'Yo‘lda yordam (evakuator)', slug: 'avtoservis-yolda-yordam-evakuator' },
    ],
  },
  {
    id: '00000000-0002-4000-8000-000000000013',
    name: 'Maishiy texnika ta’miri',
    slug: 'maishiy-texnika-tamiri',
    sortOrder: 12,
    modes: ['AT_CUSTOMER', 'AT_MASTER'],
    services: [
      { id: '00000000-0003-4000-8000-00000000002f', name: 'Kir yuvish mashinasi', slug: 'maishiy-texnika-tamiri-kir-yuvish-mashinasi' },
      { id: '00000000-0003-4000-8000-000000000030', name: 'Muzlatgich', slug: 'maishiy-texnika-tamiri-muzlatgich' },
      { id: '00000000-0003-4000-8000-000000000031', name: 'Televizor', slug: 'maishiy-texnika-tamiri-televizor' },
      { id: '00000000-0003-4000-8000-000000000032', name: 'Gaz plita va duxovka', slug: 'maishiy-texnika-tamiri-gaz-plita-va-duxovka' },
      { id: '00000000-0003-4000-8000-000000000033', name: 'Changyutgich', slug: 'maishiy-texnika-tamiri-changyutgich' },
    ],
  },
  {
    id: '00000000-0002-4000-8000-000000000014',
    name: 'Telefon va kompyuter ta’miri',
    slug: 'telefon-kompyuter-tamiri',
    sortOrder: 13,
    modes: ['AT_MASTER', 'AT_CUSTOMER'],
    services: [
      { id: '00000000-0003-4000-8000-000000000034', name: 'Telefon ekrani va batareyasi', slug: 'telefon-kompyuter-tamiri-telefon-ekrani-va-batareyasi' },
      { id: '00000000-0003-4000-8000-000000000035', name: 'Noutbuk ta’miri', slug: 'telefon-kompyuter-tamiri-noutbuk-tamiri' },
      { id: '00000000-0003-4000-8000-000000000036', name: 'Kompyuter yig‘ish', slug: 'telefon-kompyuter-tamiri-kompyuter-yigish' },
      { id: '00000000-0003-4000-8000-000000000037', name: 'Dastur o‘rnatish', slug: 'telefon-kompyuter-tamiri-dastur-ornatish' },
    ],
  },
  {
    id: '00000000-0002-4000-8000-000000000015',
    name: 'Kiyim ta’miri va ximchistka',
    slug: 'kiyim-tamiri-ximchistka',
    sortOrder: 14,
    modes: ['AT_MASTER'],
    services: [
      { id: '00000000-0003-4000-8000-000000000038', name: 'Kiyim tikish va ta’mirlash', slug: 'kiyim-tamiri-ximchistka-kiyim-tikish-va-tamirlash' },
      { id: '00000000-0003-4000-8000-000000000039', name: 'Ximchistka', slug: 'kiyim-tamiri-ximchistka-ximchistka' },
      { id: '00000000-0003-4000-8000-00000000003a', name: 'Poyabzal ta’miri', slug: 'kiyim-tamiri-ximchistka-poyabzal-tamiri' },
    ],
  },
  {
    id: '00000000-0002-4000-8000-000000000016',
    name: 'Qurilish va ta’mirlash',
    slug: 'qurilish-tamirlash',
    sortOrder: 15,
    modes: ['AT_CUSTOMER'],
    services: [
      { id: '00000000-0003-4000-8000-00000000003b', name: 'Kafel yotqizish', slug: 'qurilish-tamirlash-kafel-yotqizish' },
      { id: '00000000-0003-4000-8000-00000000003c', name: 'Bo‘yoq va suvoq', slug: 'qurilish-tamirlash-boyoq-va-suvoq' },
      { id: '00000000-0003-4000-8000-00000000003d', name: 'Gipsokarton', slug: 'qurilish-tamirlash-gipsokarton' },
      { id: '00000000-0003-4000-8000-00000000003e', name: 'Pol va laminat', slug: 'qurilish-tamirlash-pol-va-laminat' },
      { id: '00000000-0003-4000-8000-00000000003f', name: 'Eshik va deraza o‘rnatish', slug: 'qurilish-tamirlash-eshik-va-deraza-ornatish' },
      { id: '00000000-0003-4000-8000-000000000040', name: 'Tom ta’miri', slug: 'qurilish-tamirlash-tom-tamiri' },
    ],
  },
  {
    id: '00000000-0002-4000-8000-000000000017',
    name: 'Bola qarash va repetitorlik',
    slug: 'bola-qarash-repetitorlik',
    sortOrder: 16,
    modes: ['AT_CUSTOMER', 'AT_MASTER'],
    services: [
      { id: '00000000-0003-4000-8000-000000000041', name: 'Enaga', slug: 'bola-qarash-repetitorlik-enaga' },
      { id: '00000000-0003-4000-8000-000000000042', name: 'Repetitor', slug: 'bola-qarash-repetitorlik-repetitor' },
      { id: '00000000-0003-4000-8000-000000000043', name: 'Til o‘rgatish', slug: 'bola-qarash-repetitorlik-til-orgatish' },
      { id: '00000000-0003-4000-8000-000000000044', name: 'Maktabgacha tayyorlash', slug: 'bola-qarash-repetitorlik-maktabgacha-tayyorlash' },
    ],
  },
  {
    id: '00000000-0002-4000-8000-000000000018',
    name: 'Ko‘chirish va yuk tashish',
    slug: 'kochirish-yuk-tashish',
    sortOrder: 17,
    modes: ['AT_CUSTOMER'],
    services: [
      { id: '00000000-0003-4000-8000-000000000045', name: 'Uy ko‘chirish', slug: 'kochirish-yuk-tashish-uy-kochirish' },
      { id: '00000000-0003-4000-8000-000000000046', name: 'Yuk tashish', slug: 'kochirish-yuk-tashish-yuk-tashish' },
      { id: '00000000-0003-4000-8000-000000000047', name: 'Yuklovchilar (hashar)', slug: 'kochirish-yuk-tashish-yuklovchilar-hashar' },
      { id: '00000000-0003-4000-8000-000000000048', name: 'Mebel tashish', slug: 'kochirish-yuk-tashish-mebel-tashish' },
    ],
  },
  {
    id: '00000000-0002-4000-8000-000000000019',
    name: 'Bog‘ va hovli',
    slug: 'bogh-hovli',
    sortOrder: 18,
    modes: ['AT_CUSTOMER'],
    services: [
      { id: '00000000-0003-4000-8000-000000000049', name: 'Bog‘ parvarishi', slug: 'bogh-hovli-bog-parvarishi' },
      { id: '00000000-0003-4000-8000-00000000004a', name: 'Maysa o‘rish', slug: 'bogh-hovli-maysa-orish' },
      { id: '00000000-0003-4000-8000-00000000004b', name: 'Daraxt kesish', slug: 'bogh-hovli-daraxt-kesish' },
      { id: '00000000-0003-4000-8000-00000000004c', name: 'Sug‘orish tizimi', slug: 'bogh-hovli-sugorish-tizimi' },
    ],
  },
];

async function seedPolicies(): Promise<void> {
  for (const policy of POLICIES) {
    await prisma.policyVersion.upsert({
      where: { type_version: { type: policy.type, version: policy.version } },
      update: {},
      create: { ...policy, status: PolicyStatus.PUBLISHED, publishedAt: new Date('2026-01-01T00:00:00Z') },
    });
  }
}

async function seedCatalog(): Promise<void> {
  for (const category of CATEGORIES) {
    await prisma.serviceCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, sortOrder: category.sortOrder },
      create: { id: category.id, name: category.name, slug: category.slug, sortOrder: category.sortOrder, modes: category.modes ?? ['AT_CUSTOMER'] },
    });

    for (const [index, service] of category.services.entries()) {
      await prisma.service.upsert({
        where: { slug: service.slug },
        update: { name: service.name, categoryId: category.id, sortOrder: index },
        create: { id: service.id, categoryId: category.id, name: service.name, slug: service.slug, sortOrder: index },
      });
    }
  }
}

async function seedAdmin(): Promise<boolean> {
  const phone = process.env.ADMIN_PHONE?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!phone || !password) return false;
  if (password.length < 12) throw new Error('ADMIN_PASSWORD kamida 12 ta belgidan iborat bo‘lishi kerak');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { phone },
    update: { passwordHash, status: UserStatus.ACTIVE },
    create: { phone, passwordHash, firstName: 'Admin', status: UserStatus.ACTIVE, phoneVerifiedAt: new Date() },
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role: Role.ADMIN } },
    update: {},
    create: { userId: user.id, role: Role.ADMIN },
  });
  return true;
}

async function main(): Promise<void> {
  await seedPolicies();
  await seedCatalog();
  if (await seedAdmin()) console.log('Admin foydalanuvchi tayyor (ADMIN_PHONE).');
  console.log(`Seeded ${POLICIES.length} policy version(s) and ${CATEGORIES.length} service categor${CATEGORIES.length === 1 ? 'y' : 'ies'}.`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
