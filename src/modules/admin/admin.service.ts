import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CaseStatus, CaseType, OrderStatus, PaymentStatus, Prisma, ReviewStatus, Role } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { RevenueReportQueryDto } from './dto/revenue-report-query.dto';
import { CustomerQueryDto } from '../customer/dto/customer-query.dto';

const SETTLED_PAYMENT_STATUSES: PaymentStatus[] = [PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED];


function countMap<K extends string>(rows: Array<{ _count: number } & Record<K, unknown>>, key: K): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [String(row[key]), row._count]));
}

const sum = (rows: Array<{ _count: number }>) => rows.reduce((total, row) => total + row._count, 0);

@Injectable()
export class AdminService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private dateRange(dateFrom?: string, dateTo?: string): Prisma.DateTimeFilter | undefined {
    if (!dateFrom && !dateTo) return undefined;
    return { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) };
  }

  async getDashboard(query: DashboardQueryDto) {
    const createdAt = this.dateRange(query.dateFrom, query.dateTo);
    const where = createdAt ? { createdAt } : {};

    const [
      usersByStatus,
      mastersByStatus,
      mastersByVerification,
      requestsByStatus,
      bookingsCount,
      ordersByStatus,
      paymentsByStatus,
      disputesByStatus,
      reviews,
      attention,
      today,
      subscriptions,
      feed,
    ] = await Promise.all([
      this.db.user.groupBy({ by: ['status'], _count: true, where }),
      this.db.masterProfile.groupBy({ by: ['status'], _count: true, where }),
      this.db.masterProfile.groupBy({ by: ['verification'], _count: true, where }),
      this.db.problemRequest.groupBy({ by: ['status'], _count: true, where }),
      this.db.booking.count({ where }),
      this.db.order.groupBy({ by: ['status'], _count: true, where }),
      this.db.payment.groupBy({ by: ['status'], _count: true, _sum: { amount: true }, where }),
      this.db.case.groupBy({ by: ['status'], _count: true, where: { ...where, type: CaseType.DISPUTE } }),
      this.db.review.aggregate({ _count: true, _avg: { rating: true }, where: { ...where, status: ReviewStatus.PUBLISHED } }),
      this.attentionCounts(),
      this.todayCounts(),
      this.subscriptionOverview(),
      this.feedOverview(),
    ]);

    return {
      users: { total: sum(usersByStatus), byStatus: countMap(usersByStatus, 'status') },
      masters: {
        total: sum(mastersByStatus),
        byStatus: countMap(mastersByStatus, 'status'),
        byVerification: countMap(mastersByVerification, 'verification'),
      },
      requests: { total: sum(requestsByStatus), byStatus: countMap(requestsByStatus, 'status') },
      bookings: { total: bookingsCount },
      orders: { total: sum(ordersByStatus), byStatus: countMap(ordersByStatus, 'status') },
      payments: {
        byStatus: Object.fromEntries(
          paymentsByStatus.map((row) => [row.status, { count: row._count, amount: row._sum.amount ?? new Prisma.Decimal(0) }]),
        ),
      },
      disputes: { total: sum(disputesByStatus), byStatus: countMap(disputesByStatus, 'status') },
      reviews: { total: reviews._count, averageRating: reviews._avg.rating ?? 0 },
      attention,
      today,
      subscriptions,
      feed,
    };
  }

  /** E'tibor talab qiladigan navbatlar: admin birinchi shularni ko'radi. */
  private async attentionCounts() {
    const [pendingVerifications, openCases, pendingSubscriptions, activeOrders, errors24h] = await Promise.all([
      this.db.masterProfile.count({ where: { verification: 'PENDING' } }),
      this.db.case.count({ where: { status: { in: [CaseStatus.REPORTED, CaseStatus.UNDER_REVIEW] } } }),
      this.db.subscription.count({ where: { status: 'PENDING' } }),
      this.db.order.count({ where: { status: { in: [OrderStatus.CONFIRMED, OrderStatus.ON_THE_WAY, OrderStatus.ARRIVED, OrderStatus.IN_PROGRESS, OrderStatus.WAITING_CONFIRMATION] } } }),
      this.db.errorLog.count({ where: { severity: 'ERROR', createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
    ]);
    return { pendingVerifications, openCases, pendingSubscriptions, activeOrders, errors24h };
  }

  /** Bugungi (server vaqti bilan, 00:00 dan) yangi yozuvlar va tushum. */
  private async todayCounts() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const gte = { createdAt: { gte: start } };
    const [newUsers, newRequests, newOrders, completedOrders, revenue] = await Promise.all([
      this.db.user.count({ where: gte }),
      this.db.problemRequest.count({ where: gte }),
      this.db.order.count({ where: gte }),
      this.db.order.count({ where: { status: OrderStatus.COMPLETED, completedAt: { gte: start } } }),
      this.db.payment.aggregate({ where: { status: { in: SETTLED_PAYMENT_STATUSES }, succeededAt: { gte: start } }, _sum: { amount: true } }),
    ]);
    return { newUsers, newRequests, newOrders, completedOrders, revenue: revenue._sum.amount ?? new Prisma.Decimal(0) };
  }

  /** Faol obunalar (reja bo'yicha) va tasdiqlangan obuna tushumi. */
  private async subscriptionOverview() {
    const [active, income] = await Promise.all([
      this.db.subscription.groupBy({ by: ['planCode'], _count: true, where: { status: 'ACTIVE', endsAt: { gt: new Date() } } }),
      this.db.subscription.aggregate({ where: { status: 'ACTIVE', source: 'PURCHASE' }, _sum: { amount: true }, _count: true }),
    ]);
    return {
      activeByPlan: Object.fromEntries(active.map((row) => [row.planCode, row._count])),
      activeTotal: active.reduce((total, row) => total + row._count, 0),
      purchasedCount: income._count,
      purchasedAmount: income._sum.amount ?? new Prisma.Decimal(0),
    };
  }

  /** Ish lentasi: postlar, ko'rishlar, izohlar. */
  private async feedOverview() {
    const [posts, totals, comments] = await Promise.all([
      this.db.workPost.count({ where: { status: 'PUBLISHED' } }),
      this.db.workPost.aggregate({ where: { status: 'PUBLISHED' }, _sum: { viewCount: true, likeCount: true, shareCount: true } }),
      this.db.workPostComment.count(),
    ]);
    return { posts, views: totals._sum.viewCount ?? 0, likes: totals._sum.likeCount ?? 0, shares: totals._sum.shareCount ?? 0, comments };
  }

  async getRevenueReport(query: RevenueReportQueryDto) {
    const range = this.dateRange(query.dateFrom, query.dateTo);
    const paymentWhere: Prisma.PaymentWhereInput = { status: { in: SETTLED_PAYMENT_STATUSES }, ...(range ? { succeededAt: range } : {}) };
    const orderWhere: Prisma.OrderWhereInput = range ? { createdAt: range } : {};

    const [revenue, totalOrders, completedOrders, cancelledOrders, disputeCount, rows] = await Promise.all([
      this.db.payment.aggregate({ where: paymentWhere, _sum: { amount: true, refundedAmount: true }, _count: true }),
      this.db.order.count({ where: orderWhere }),
      this.db.order.count({ where: { ...orderWhere, status: OrderStatus.COMPLETED } }),
      this.db.order.count({ where: { ...orderWhere, status: OrderStatus.CANCELLED } }),
      this.db.case.count({ where: { type: CaseType.DISPUTE, ...(range ? { createdAt: range } : {}) } }),
      this.db.payment.findMany({
        where: paymentWhere,
        select: { id: true, orderId: true, provider: true, amount: true, refundedAmount: true, currency: true, succeededAt: true },
        orderBy: { createdAt: 'desc' },
        ...cursorArgs(query),
      }),
    ]);

    const gross = revenue._sum.amount ?? new Prisma.Decimal(0);
    const refunded = revenue._sum.refundedAmount ?? new Prisma.Decimal(0);
    const netRevenue = gross.sub(refunded);
    const commissionRate = this.config.get<number>('payment.platformCommissionRate', 0.05);
    return {
      summary: {
        totalRevenue: gross,
        totalRefunded: refunded,
        netRevenue,
        // Ilova (platforma) sof foydasi — sof tushumning komissiya ulushi (PLATFORM_COMMISSION_RATE).
        platformProfit: netRevenue.mul(commissionRate),
        commissionRate,
        totalPayments: revenue._count,
        totalOrders,
        completedOrders,
        cancelledOrders,
        disputeCount,
      },
      ...toCursorPage(rows, query),
    };
  }

  async findAllCustomers(query: CustomerQueryDto) {
    const where: Prisma.UserWhereInput = {
      userRoles: { some: { role: Role.CUSTOMER } },
      status: query.status,
      deletedAt: null,
    };
    if (query.search) {
      where.OR = [
        { phone: { contains: query.search } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const rows = await this.db.user.findMany({
      where,
      select: { id: true, phone: true, email: true, firstName: true, lastName: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      ...cursorArgs(query),
    });
    return toCursorPage(rows, query);
  }
}
