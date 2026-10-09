import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CaseStatus, CaseType, OrderStatus, PaymentStatus, Prisma, ReviewStatus, Role } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { PLANS } from '../subscription/plans.config';
import { PaymentsReportQueryDto } from './dto/payments-report-query.dto';
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

  /**
   * Davr bo'yicha yig'ma ko'rsatkichlar (hisobotlar uchun). Hisoblash qoidalari (grafik va kartalarda bir xil):
   *  - tushum: muvaffaqiyatli to'lovlar summasi, to'lov muvaffaqiyatli bo'lgan kun bo'yicha;
   *  - qaytarilgan: muvaffaqiyatli qaytarishlar (refunds jurnali), qaytarish yakunlangan kun bo'yicha;
   *  - to'lovlar: davrda yaratilgan barcha to'lovlar (jadvaldagi «Jami» bilan bir xil);
   *  - buyurtmalar: yaratilgan; yakunlangan / bekor qilingan: shu holatga o'tgan kun bo'yicha;
   *  - platforma daromadi: yakunlangan buyurtmalarda SAQLANGAN komissiya summasi (taxmin emas).
   */
  private async periodTotals(from: Date | null, to: Date | null) {
    const range = (field: string): Record<string, Prisma.DateTimeFilter> | Record<string, never> => (from || to ? { [field]: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {});
    const [pay, refunds, createdPayments, orders, completed, cancelled, fee] = await Promise.all([
      this.db.payment.aggregate({ where: { status: { in: SETTLED_PAYMENT_STATUSES }, ...range('succeededAt') }, _sum: { amount: true }, _count: true }),
      this.db.refund.aggregate({ where: { status: 'SUCCEEDED', ...range('completedAt') }, _sum: { amount: true } }),
      this.db.payment.count({ where: range('createdAt') }),
      this.db.order.count({ where: range('createdAt') }),
      this.db.order.count({ where: { status: OrderStatus.COMPLETED, ...range('completedAt') } }),
      this.db.order.count({ where: { status: OrderStatus.CANCELLED, ...range('cancelledAt') } }),
      this.db.order.aggregate({ where: { status: OrderStatus.COMPLETED, ...range('completedAt') }, _sum: { platformFee: true }, _count: { platformFee: true } }),
    ]);
    return {
      revenue: Number(pay._sum.amount ?? 0),
      refunded: Number(refunds._sum.amount ?? 0),
      settledPayments: pay._count,
      payments: createdPayments,
      orders,
      completed,
      cancelled,
      platformFee: Number(fee._sum.platformFee ?? 0),
      completedWithoutFee: completed - fee._count.platformFee,
    };
  }

  /**
   * «Hisobotlar» sahifasi: davr ko'rsatkichlari, oldingi shunday davr bilan solishtirish, kunlik dinamika (Toshkent kunlari),
   * to'lovlar holati bo'yicha taqsimot va hisob-kitob mosligi tekshiruvi (to'lovdagi qaytarilgan summa ↔ qaytarishlar jurnali).
   * Davr tanlanmasa — butun davr (solishtirishsiz), grafik oxirgi 30 kun.
   */
  async getReportsOverview(query: { dateFrom?: string; dateTo?: string }) {
    const hasRange = !!(query.dateFrom || query.dateTo);
    const now = new Date();
    const to = query.dateTo ? new Date(query.dateTo) : now;
    const from = query.dateFrom ? new Date(query.dateFrom) : new Date(to.getTime() - 29 * 86_400_000);
    const spanMs = Math.max(86_400_000, to.getTime() - from.getTime());
    const current = await this.periodTotals(query.dateFrom ? from : null, hasRange ? to : null);
    const previous = query.dateFrom && query.dateTo ? await this.periodTotals(new Date(from.getTime() - spanMs - 1), new Date(from.getTime() - 1)) : null;

    // Kunlik kesim: Toshkent vaqti bo'yicha (UTC emas), aks holda kechki to'lovlar noto'g'ri kunga tushadi.
    const tz = 'Asia/Tashkent';
    const TZ_MS = 5 * 3_600_000; // Toshkent UTC+5 (yozgi vaqt yo'q)
    const localDay = (date: Date) => Math.floor((date.getTime() + TZ_MS) / 86_400_000);
    const days = Math.min(92, Math.max(1, localDay(to) - localDay(from) + 1));
    const rows = await this.db.$queryRaw<Array<{ day: string; revenue: unknown; refunded: unknown; payments: bigint; orders: bigint; completed: bigint; cancelled: bigint }>>`
      WITH d AS (
        SELECT generate_series(
          date_trunc('day', ${to}::timestamptz AT TIME ZONE ${tz}) - ((${days} - 1) * interval '1 day'),
          date_trunc('day', ${to}::timestamptz AT TIME ZONE ${tz}),
          interval '1 day') AS day)
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
        (SELECT COALESCE(sum(p.amount), 0) FROM payments p WHERE p.status IN ('SUCCEEDED','PARTIALLY_REFUNDED','REFUNDED') AND (p.succeeded_at AT TIME ZONE ${tz}) >= d.day AND (p.succeeded_at AT TIME ZONE ${tz}) < d.day + interval '1 day') AS revenue,
        (SELECT COALESCE(sum(r.amount), 0) FROM refunds r WHERE r.status = 'SUCCEEDED' AND (r.completed_at AT TIME ZONE ${tz}) >= d.day AND (r.completed_at AT TIME ZONE ${tz}) < d.day + interval '1 day') AS refunded,
        (SELECT count(*) FROM payments p WHERE (p."createdAt" AT TIME ZONE ${tz}) >= d.day AND (p."createdAt" AT TIME ZONE ${tz}) < d.day + interval '1 day') AS payments,
        (SELECT count(*) FROM orders o WHERE (o."createdAt" AT TIME ZONE ${tz}) >= d.day AND (o."createdAt" AT TIME ZONE ${tz}) < d.day + interval '1 day') AS orders,
        (SELECT count(*) FROM orders o WHERE o.status = 'COMPLETED' AND (o.completed_at AT TIME ZONE ${tz}) >= d.day AND (o.completed_at AT TIME ZONE ${tz}) < d.day + interval '1 day') AS completed,
        (SELECT count(*) FROM orders o WHERE o.status = 'CANCELLED' AND (o.cancelled_at AT TIME ZONE ${tz}) >= d.day AND (o.cancelled_at AT TIME ZONE ${tz}) < d.day + interval '1 day') AS cancelled
      FROM d ORDER BY d.day`;

    const byStatus = await this.db.payment.groupBy({
      by: ['status'],
      _count: true,
      where: hasRange ? { createdAt: { ...(query.dateFrom ? { gte: from } : {}), lte: to } } : {},
    });
    const count = (...statuses: PaymentStatus[]) => byStatus.filter((row) => statuses.includes(row.status)).reduce((total, row) => total + row._count, 0);

    const mismatches = await this.db.$queryRaw<Array<{ id: string; recorded: unknown; ledger: unknown }>>`
      SELECT p.id, p.refunded_amount AS recorded, COALESCE(SUM(r.amount) FILTER (WHERE r.status = 'SUCCEEDED'), 0) AS ledger
      FROM payments p LEFT JOIN refunds r ON r."paymentId" = p.id
      GROUP BY p.id, p.refunded_amount
      HAVING p.refunded_amount <> COALESCE(SUM(r.amount) FILTER (WHERE r.status = 'SUCCEEDED'), 0)
      ORDER BY abs(p.refunded_amount - COALESCE(SUM(r.amount) FILTER (WHERE r.status = 'SUCCEEDED'), 0)) DESC
      LIMIT 5`;

    return {
      commissionRate: this.config.get<number>('payment.platformCommissionRate', 0.05),
      range: { from: from.toISOString(), to: to.toISOString(), all: !hasRange },
      current,
      previous,
      series: rows.map((row) => ({
        date: row.day,
        revenue: Number(row.revenue),
        refunded: Number(row.refunded),
        payments: Number(row.payments),
        orders: Number(row.orders),
        completed: Number(row.completed),
        cancelled: Number(row.cancelled),
      })),
      paymentStatus: {
        succeeded: count(PaymentStatus.SUCCEEDED),
        pending: count(PaymentStatus.PENDING, PaymentStatus.PROCESSING),
        refunded: count(PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED),
        failed: count(PaymentStatus.FAILED),
        cancelled: count(PaymentStatus.CANCELLED),
      },
      reconciliation: {
        mismatchCount: mismatches.length,
        items: mismatches.map((row) => ({ paymentId: row.id, recorded: Number(row.recorded), ledger: Number(row.ledger), difference: Number(row.recorded) - Number(row.ledger) })),
      },
    };
  }

  /** «So'nggi to'lovlar» jadvali: har qanday holatdagi to'lovlar; qidiruv (ID, buyurtma №, mijoz, summa), holat/tur filtri, saralash, sahifalash. */
  async getReportPayments(query: PaymentsReportQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const search = query.search?.trim().replace(/^#/, '');
    const created = this.dateRange(query.dateFrom, query.dateTo);
    const numeric = search && /^\d+([.,]\d+)?$/.test(search) ? Number(search.replace(',', '.')) : null;
    let idMatches: string[] = [];
    if (search && /^[0-9a-f-]{4,36}$/i.test(search)) {
      const found = await this.db.$queryRaw<Array<{ id: string }>>`SELECT id::text AS id FROM payments WHERE id::text ILIKE ${`${search}%`} LIMIT 50`;
      idMatches = found.map((row) => row.id);
    }
    const statusGroups: Record<string, PaymentStatus[]> = {
      succeeded: [PaymentStatus.SUCCEEDED],
      pending: [PaymentStatus.PENDING, PaymentStatus.PROCESSING],
      refunded: [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED],
      other: [PaymentStatus.FAILED, PaymentStatus.CANCELLED],
    };
    const where: Prisma.PaymentWhereInput = {
      ...(created ? { createdAt: created } : {}),
      ...(query.provider ? { provider: query.provider } : {}),
      ...(query.status ? { status: { in: statusGroups[query.status]! } } : {}),
      ...(search
        ? {
            OR: [
              ...(idMatches.length ? [{ id: { in: idMatches } }] : []),
              ...(numeric != null ? [{ amount: new Prisma.Decimal(numeric) }, ...(Number.isInteger(numeric) && numeric < 2_000_000_000 ? [{ order: { orderNumber: numeric } }] : [])] : []),
              { customer: { OR: [{ firstName: { contains: search, mode: 'insensitive' as const } }, { lastName: { contains: search, mode: 'insensitive' as const } }, { phone: { contains: search } }] } },
            ],
          }
        : {}),
    };
    const dir = query.dir === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.PaymentOrderByWithRelationInput[] =
      query.sort === 'amount' ? [{ amount: dir }, { createdAt: 'desc' }] : query.sort === 'status' ? [{ status: dir }, { createdAt: 'desc' }] : [{ createdAt: dir }];
    const [total, rows, totals] = await Promise.all([
      this.db.payment.count({ where }),
      this.db.payment.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          orderId: true,
          provider: true,
          status: true,
          amount: true,
          refundedAmount: true,
          currency: true,
          createdAt: true,
          succeededAt: true,
          order: { select: { orderNumber: true } },
          customer: { select: { id: true, accountNumber: true, firstName: true, lastName: true, phone: true } },
        },
      }),
      this.db.payment.aggregate({ where: { ...where, status: { in: SETTLED_PAYMENT_STATUSES } }, _sum: { amount: true, refundedAmount: true } }),
    ]);
    return {
      items: rows,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      /** Filtrga mos muvaffaqiyatli to'lovlar yig'indisi (jadval pastida ko'rsatiladi). */
      filteredSettled: { amount: Number(totals._sum.amount ?? 0), refunded: Number(totals._sum.refundedAmount ?? 0) },
    };
  }

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
      recentOrders,
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
      this.recentOrders(),
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
      recentOrders,
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

  /** Obunalar: mijoz (Plus) va usta (Pro) bo'yicha alohida — faol, kutayotgan, tez orada tugaydigan, sotib olingan, sovg'a va tushum. */
  private async subscriptionOverview() {
    const now = new Date();
    const soon = new Date(now.getTime() + 7 * 86_400_000);
    const audiences = ['CUSTOMER', 'MASTER'] as const;
    const stats = await Promise.all(
      audiences.map(async (audience) => {
        const plan = PLANS.find((item) => item.audience === audience);
        const [active, pending, expiringSoon, purchased, gifted, revenue] = await Promise.all([
          this.db.subscription.count({ where: { audience, status: 'ACTIVE', endsAt: { gt: now } } }),
          this.db.subscription.count({ where: { audience, status: 'PENDING' } }),
          this.db.subscription.count({ where: { audience, status: 'ACTIVE', endsAt: { gt: now, lte: soon } } }),
          this.db.subscription.count({ where: { audience, source: 'PURCHASE', status: { in: ['ACTIVE', 'EXPIRED'] } } }),
          this.db.subscription.count({ where: { audience, source: 'GRANT', status: 'ACTIVE', endsAt: { gt: now } } }),
          this.db.subscription.aggregate({ where: { audience, source: 'PURCHASE', status: { in: ['ACTIVE', 'EXPIRED'] } }, _sum: { amount: true } }),
        ]);
        return [audience, { planCode: plan?.code ?? null, planName: plan?.name ?? null, monthlyPrice: plan?.prices[1] ?? null, active, pending, expiringSoon, purchased, gifted, revenue: revenue._sum.amount ?? new Prisma.Decimal(0) }] as const;
      }),
    );
    const byAudience = Object.fromEntries(stats) as Record<(typeof audiences)[number], (typeof stats)[number][1]>;
    return {
      activeTotal: byAudience.CUSTOMER.active + byAudience.MASTER.active,
      revenueTotal: byAudience.CUSTOMER.revenue.add(byAudience.MASTER.revenue),
      customer: byAudience.CUSTOMER,
      master: byAudience.MASTER,
    };
  }

  /** Oxirgi buyurtmalar (jadval uchun): raqam, mijoz, xizmat, usta, holat, sana. */
  private async recentOrders() {
    const person = { select: { id: true, accountNumber: true, firstName: true, lastName: true } };
    const rows = await this.db.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        finalAmount: true,
        currency: true,
        customer: person,
        master: { select: { profession: true, user: person } },
        booking: { select: { request: { select: { title: true, category: { select: { name: true } } } }, service: { select: { name: true } } } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      status: row.status,
      createdAt: row.createdAt,
      finalAmount: row.finalAmount,
      currency: row.currency,
      customer: row.customer,
      master: row.master.user,
      service: row.booking.service?.name ?? row.booking.request.category?.name ?? row.booking.request.title,
    }));
  }

  /** Buyurtmalar dinamikasi: oxirgi `days` kun, har kun uchun yaratilgan va yakunlangan buyurtmalar (bo'sh kunlar 0). */
  async getOrdersSeries(days: number) {
    const span = [7, 30, 90].includes(days) ? days : 7;
    const rows = await this.db.$queryRaw<Array<{ day: Date; created: bigint; completed: bigint }>>`
      WITH d AS (SELECT generate_series(date_trunc('day', now()) - (${span - 1} * interval '1 day'), date_trunc('day', now()), interval '1 day') AS day)
      SELECT d.day,
             (SELECT count(*) FROM orders o WHERE o."createdAt" >= d.day AND o."createdAt" < d.day + interval '1 day') AS created,
             (SELECT count(*) FROM orders o WHERE o.status = 'COMPLETED' AND o.completed_at >= d.day AND o.completed_at < d.day + interval '1 day') AS completed
      FROM d ORDER BY d.day`;
    return { days: span, points: rows.map((row) => ({ date: row.day.toISOString(), created: Number(row.created), completed: Number(row.completed) })) };
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
