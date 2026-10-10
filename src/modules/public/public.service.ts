import { REGIONS, regionName } from '../../common/constants/regions';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PublicMasterQueryDto, PublicServiceQueryDto } from './dto/public-master-query.dto';

const STATS_TTL_MS = 5 * 60_000;

export interface PriceCategory {
  id: string;
  name: string;
  modes: Array<'AT_CUSTOMER' | 'AT_MASTER'>;
  masters: number;
  services: Array<{ id: string; name: string; minPrice: number | null; masters: number }>;
}

@Injectable()
export class PublicService {
  private statsCache: { at: number; value: unknown } | null = null;
  private pricesCache: { at: number; value: PriceCategory[] } | null = null;

  constructor(private readonly db: PrismaService) {}

  private listed(): Prisma.MasterProfileWhereInput {
    return { status: 'ACTIVE', verification: 'VERIFIED', isPaused: false, user: { deletedAt: null, status: 'ACTIVE' } };
  }

  /** Ommaviy usta katalogi: faqat ism + familiya bosh harfi, kasb, reyting, xizmatlar. Aloqa ma’lumoti yo‘q. */
  async masters(query: PublicMasterQueryDto) {
    const limit = query.limit ?? 12;
    const page = query.page ?? 1;
    const q = query.q?.trim();
    const where: Prisma.MasterProfileWhereInput = {
      ...this.listed(),
      ...(query.mode ? { serviceModes: { has: query.mode } } : {}),
      ...(query.region ? { region: query.region } : {}),
      ...(query.categoryId ? { services: { some: { isActive: true, service: { isActive: true, categoryId: query.categoryId } } } } : {}),
      ...(q
        ? {
            OR: [
              { profession: { contains: q, mode: 'insensitive' } },
              { user: { firstName: { contains: q, mode: 'insensitive' } } },
              { services: { some: { isActive: true, service: { name: { contains: q, mode: 'insensitive' } } } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.db.masterProfile.count({ where }),
      this.db.masterProfile.findMany({
        where,
        orderBy: [{ isPro: 'desc' }, { ratingAvg: 'desc' }, { completedOrders: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          profession: true,
          experienceYears: true,
          ratingAvg: true,
          ratingCount: true,
          completedOrders: true,
          isPro: true,
          proUntil: true,
          serviceModes: true,
          placeAddress: true,
          region: true,
          user: { select: { accountNumber: true, firstName: true, lastName: true, avatarAssetId: true } },
          services: { where: { isActive: true, service: { isActive: true } }, take: 3, orderBy: { basePrice: 'asc' }, select: { basePrice: true, service: { select: { name: true } } } },
          _count: { select: { portfolio: { where: { status: 'APPROVED' } } } },
        },
      }),
    ]);
    const now = new Date();
    return {
      total,
      page,
      hasMore: page * limit < total,
      items: rows.map((row) => ({
        id: row.user.accountNumber,
        // Ism kiritilmagan bo‘lsa «null» emas, hisob raqami ko‘rsatiladi.
        name: [row.user.firstName, row.user.lastName ? `${row.user.lastName.charAt(0)}.` : null].filter(Boolean).join(' ') || `Usta #${row.user.accountNumber}`,
        profession: row.profession,
        experienceYears: row.experienceYears,
        rating: Number(row.ratingAvg),
        reviews: row.ratingCount,
        completedOrders: row.completedOrders,
        works: row._count.portfolio,
        isPro: row.isPro && (!row.proUntil || row.proUntil > now),
        region: row.region,
        regionName: regionName(row.region),
        serviceModes: row.serviceModes,
        placeAddress: row.serviceModes.includes('AT_MASTER') ? row.placeAddress : null,
        services: row.services.map((item) => ({ name: item.service.name, price: item.basePrice == null ? null : Number(item.basePrice) })),
      })),
    };
  }

  /** 14 hudud va ularda nechta faol, tasdiqlangan usta borligi (hududlar filtri uchun). */
  async regions() {
    const grouped = await this.db.masterProfile.groupBy({ by: ['region'], where: { ...this.listed(), region: { not: null } }, _count: { _all: true } });
    const counts = new Map(grouped.map((row) => [row.region, row._count._all]));
    return REGIONS.map((region) => ({ key: region.key, name: region.name, masters: counts.get(region.key) ?? 0 }));
  }

  /** Bosh sahifa raqamlari. Faqat haqiqiy hisob; 5 daqiqa keshlanadi. */
  async stats() {
    if (this.statsCache && Date.now() - this.statsCache.at < STATS_TTL_MS) return this.statsCache.value;
    const [masters, completed, categories, services, rating] = await Promise.all([
      this.db.masterProfile.count({ where: this.listed() }),
      this.db.order.count({ where: { status: 'COMPLETED' } }),
      this.db.serviceCategory.count({ where: { isActive: true } }),
      this.db.service.count({ where: { isActive: true } }),
      this.db.masterProfile.aggregate({ where: { ...this.listed(), ratingCount: { gt: 0 } }, _avg: { ratingAvg: true } }),
    ]);
    const value = { masters, completedOrders: completed, categories, services, avgRating: rating._avg.ratingAvg ? Math.round(Number(rating._avg.ratingAvg) * 10) / 10 : null };
    this.statsCache = { at: Date.now(), value };
    return value;
  }

  /**
   * Xizmatlar katalogi: har bir xizmat uchun ustalar soni, eng past narx va o‘rtacha reyting (ustalarning reytingi sharhlar soniga
   * ko‘ra tortilgan o‘rtacha). Faqat ochiq (faol, tasdiqlangan, pauzada emas) ustalar hisobga olinadi; hudud tanlansa — shu hududdagilar.
   * Filtrlarning har biri uchun sonlar (faset) boshqa filtrlarni hisobga olib qaytariladi.
   */
  async services(query: PublicServiceQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const [services, links] = await Promise.all([
      this.db.service.findMany({
        where: { isActive: true, category: { isActive: true } },
        select: { id: true, name: true, description: true, sortOrder: true, category: { select: { id: true, name: true, sortOrder: true } } },
      }),
      this.db.masterService.findMany({
        where: { isActive: true, service: { isActive: true }, master: { ...this.listed(), ...(query.region ? { region: query.region } : {}) } },
        select: { serviceId: true, basePrice: true, master: { select: { id: true, ratingAvg: true, ratingCount: true } } },
      }),
    ]);
    interface Agg { masters: Set<string>; prices: number[]; weighted: number; count: number; rated: Set<string> }
    const byService = new Map<string, Agg>();
    for (const link of links) {
      const entry: Agg = byService.get(link.serviceId) ?? { masters: new Set<string>(), prices: [], weighted: 0, count: 0, rated: new Set<string>() };
      entry.masters.add(link.master.id);
      if (link.basePrice != null) entry.prices.push(Number(link.basePrice));
      if (!entry.rated.has(link.master.id)) {
        entry.rated.add(link.master.id);
        entry.weighted += Number(link.master.ratingAvg) * link.master.ratingCount;
        entry.count += link.master.ratingCount;
      }
      byService.set(link.serviceId, entry);
    }
    interface Row { id: string; name: string; description: string | null; sortOrder: number; category: { id: string; name: string; sortOrder: number }; masters: number; minPrice: number | null; maxPrice: number | null; rating: number | null; ratingCount: number }
    let rows: Row[] = services.map((service) => {
      const entry = byService.get(service.id);
      return {
        ...service,
        masters: entry?.masters.size ?? 0,
        minPrice: entry && entry.prices.length ? Math.min(...entry.prices) : null,
        maxPrice: entry && entry.prices.length ? Math.max(...entry.prices) : null,
        rating: entry && entry.count > 0 ? Math.round((entry.weighted / entry.count) * 10) / 10 : null,
        ratingCount: entry?.count ?? 0,
      };
    });

    const q = query.q?.trim().toLowerCase();
    if (q) rows = rows.filter((row) => `${row.name} ${row.description ?? ''} ${row.category.name}`.toLowerCase().includes(q));
    const categoryIds = query.categories ? new Set(query.categories.split(',')) : null;
    const matches = {
      price: (row: Row) => (query.minPrice === undefined && query.maxPrice === undefined) || (row.minPrice !== null && row.minPrice >= (query.minPrice ?? 0) && row.minPrice <= (query.maxPrice ?? Number.MAX_SAFE_INTEGER)),
      masters: (row: Row) => !query.masters || (query.masters === '1' ? row.masters === 1 : query.masters === '2-3' ? row.masters >= 2 && row.masters <= 3 : row.masters >= 4),
      rating: (row: Row) => query.minRating === undefined || (row.rating !== null && row.rating >= query.minRating),
      available: (row: Row) => !query.available || row.masters > 0,
      category: (row: Row) => !categoryIds || categoryIds.has(row.category.id),
    };
    const without = (skip: keyof typeof matches) => rows.filter((row) => (Object.keys(matches) as Array<keyof typeof matches>).every((key) => key === skip || matches[key](row)));

    // Faset sonlari: har bir filtr uchun o‘zining filtrisiz boshqa filtrlar bo‘yicha.
    const categoryFacet = new Map<string, { id: string; name: string; sortOrder: number; count: number }>();
    for (const row of without('category')) {
      const entry = categoryFacet.get(row.category.id) ?? { ...row.category, count: 0 };
      entry.count += 1;
      categoryFacet.set(row.category.id, entry);
    }
    const priced = without('price').filter((row) => row.minPrice !== null);
    const mastersBase = without('masters');
    const ratingBase = without('rating');
    const filtered = rows.filter((row) => (Object.keys(matches) as Array<keyof typeof matches>).every((key) => matches[key](row)));

    const sort = query.sort ?? 'popular';
    filtered.sort((a, b) => {
      if (sort === 'price_asc') return (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity) || a.name.localeCompare(b.name);
      if (sort === 'price_desc') return (b.minPrice ?? -1) - (a.minPrice ?? -1) || a.name.localeCompare(b.name);
      if (sort === 'rating') return (b.rating ?? -1) - (a.rating ?? -1) || b.ratingCount - a.ratingCount || a.name.localeCompare(b.name);
      if (sort === 'name') return a.name.localeCompare(b.name);
      return b.masters - a.masters || (b.rating ?? -1) - (a.rating ?? -1) || a.category.sortOrder - b.category.sortOrder || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
    });
    const total = filtered.length;
    return {
      items: filtered.slice((page - 1) * limit, page * limit).map(({ sortOrder: _s, ...row }) => ({ ...row, category: { id: row.category.id, name: row.category.name } })),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      facets: {
        categories: [...categoryFacet.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)).map(({ id, name, count }) => ({ id, name, count })),
        price: { min: priced.length ? Math.min(...priced.map((row) => row.minPrice as number)) : 0, max: priced.length ? Math.max(...priced.map((row) => row.minPrice as number)) : 0 },
        masters: { one: mastersBase.filter((row) => row.masters === 1).length, few: mastersBase.filter((row) => row.masters >= 2 && row.masters <= 3).length, many: mastersBase.filter((row) => row.masters >= 4).length },
        ratings: { r45: ratingBase.filter((row) => (row.rating ?? 0) >= 4.5).length, r40: ratingBase.filter((row) => (row.rating ?? 0) >= 4).length, r35: ratingBase.filter((row) => (row.rating ?? 0) >= 3.5).length },
        available: without('available').filter((row) => row.masters > 0).length,
      },
    };
  }

  /** Xizmat narxlari: kategoriya bo‘yicha «dan …» (ustalar belgilagan eng past narx) va xizmat ko‘rsatuvchi ustalar soni. 5 daqiqa keshlanadi. */
  async prices(): Promise<PriceCategory[]> {
    if (this.pricesCache && Date.now() - this.pricesCache.at < STATS_TTL_MS) return this.pricesCache.value;
    const [categories, grouped] = await Promise.all([
      this.db.serviceCategory.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, modes: true, services: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true } } },
      }),
      this.db.masterService.groupBy({
        by: ['serviceId'],
        where: { isActive: true, master: this.listed() },
        _min: { basePrice: true },
        _count: { _all: true },
      }),
    ]);
    const stat = new Map(grouped.map((row) => [row.serviceId, row]));
    const value: PriceCategory[] = [];
    for (const category of categories) {
      const services = category.services.map((service) => {
        const row = stat.get(service.id);
        return { id: service.id, name: service.name, minPrice: row?._min.basePrice == null ? null : Number(row._min.basePrice), masters: row?._count._all ?? 0 };
      });
      const masters = await this.db.masterProfile.count({ where: { ...this.listed(), services: { some: { isActive: true, service: { isActive: true, categoryId: category.id } } } } });
      if (services.length === 0 || masters === 0) continue;
      value.push({ id: category.id, name: category.name, modes: category.modes, masters, services });
    }
    this.pricesCache = { at: Date.now(), value };
    return value;
  }
}
