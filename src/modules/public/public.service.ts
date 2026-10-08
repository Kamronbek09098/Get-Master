import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PublicMasterQueryDto } from './dto/public-master-query.dto';

const STATS_TTL_MS = 5 * 60_000;

@Injectable()
export class PublicService {
  private statsCache: { at: number; value: unknown } | null = null;

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
          user: { select: { accountNumber: true, firstName: true, lastName: true } },
          services: { where: { isActive: true, service: { isActive: true } }, take: 4, select: { service: { select: { name: true } } } },
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
        name: `${row.user.firstName}${row.user.lastName ? ` ${row.user.lastName.charAt(0)}.` : ''}`,
        profession: row.profession,
        experienceYears: row.experienceYears,
        rating: Number(row.ratingAvg),
        reviews: row.ratingCount,
        completedOrders: row.completedOrders,
        works: row._count.portfolio,
        isPro: row.isPro && (!row.proUntil || row.proUntil > now),
        services: row.services.map((item) => item.service.name),
      })),
    };
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
}
