import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CaseType, OrderStatus, PaymentStatus, Prisma, ReviewStatus, Role } from '@prisma/client';
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
    };
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
    const commissionRate = this.config.get<number>('payment.platformCommissionRate', 0.03);
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
