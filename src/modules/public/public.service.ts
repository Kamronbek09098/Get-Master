import { REGIONS, regionName } from '../../common/constants/regions';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PublicMasterQueryDto } from './dto/public-master-query.dto';

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
          user: { select: { accountNumber: true, firstName: true, lastName: true } },
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
