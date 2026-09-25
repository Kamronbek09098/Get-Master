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
      create: { id: category.id, name: category.name, slug: category.slug, sortOrder: category.sortOrder },
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
