import { findPairConversation } from '../communication/pair-conversation';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { ERRORS } from '../../common/constants/error-messages';
import { cursorArgs, dateRangeWhere, toCursorPage } from '../../common/utils/cursor';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderService } from '../order/order.service';
import { AdminOrderQueryDto } from './dto/order-query.dto';

const PERSON = { id: true, accountNumber: true, firstName: true, lastName: true, avatarAssetId: true, phone: true } as const;
export const ACTIVE: OrderStatus[] = ['BOOKED', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'WAITING_CONFIRMATION', 'DISPUTED'];

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly db: PrismaService,
    private readonly orders: OrderService,
  ) {}

  async findAll(query: AdminOrderQueryDto) {
    const search = query.search?.trim();
    const numeric = search && /^#?\d{1,9}$/.test(search) ? Number(search.replace('#', '')) : null;
    const where: Prisma.OrderWhereInput = {
      ...(query.ongoing ? { status: { in: ACTIVE } } : { status: query.status }),
      createdAt: dateRangeWhere(query),
      ...(query.payment ? (query.payment === 'NONE' ? { payments: { none: {} } } : { payments: { some: { status: query.payment } } }) : {}),
      ...(query.category || query.city
        ? { booking: { request: { ...(query.category ? { categoryId: query.category } : {}), ...(query.city ? { address: { city: { equals: query.city, mode: 'insensitive' as const } } } : {}) } } }
        : {}),
      ...(query.flagged ? { OR: [{ status: 'DISPUTED' }, { cases: { some: { status: { in: ['REPORTED', 'UNDER_REVIEW'] } } } }] } : {}),
      ...(search
        ? {
            AND: [
              {
                OR: [
                  ...(numeric !== null ? [{ orderNumber: numeric }, { customer: { accountNumber: numeric } }, { master: { user: { accountNumber: numeric } } }] : []),
                  { customer: { OR: [{ phone: { contains: search } }, { firstName: { contains: search, mode: 'insensitive' as const } }, { lastName: { contains: search, mode: 'insensitive' as const } }] } },
                  { master: { user: { OR: [{ phone: { contains: search } }, { firstName: { contains: search, mode: 'insensitive' as const } }, { lastName: { contains: search, mode: 'insensitive' as const } }] } } },
                  { booking: { request: { title: { contains: search, mode: 'insensitive' as const } } } },
                ],
              },
            ],
          }
        : {}),
    };
    const dir = query.dir ?? 'desc';
    const orderBy: Prisma.OrderOrderByWithRelationInput[] = query.sort === 'amount' ? [{ finalAmount: dir }, { id: 'desc' }] : [{ createdAt: dir }, { id: 'desc' }];
    const select = {
      id: true,
      orderNumber: true,
      status: true,
      originalAmount: true,
      additionalAmount: true,
      finalAmount: true,
      platformFee: true,
      currency: true,
      createdAt: true,
      completedAt: true,
      cancelledAt: true,
      customer: { select: PERSON },
      master: { select: { id: true, profession: true, ratingAvg: true, ratingCount: true, user: { select: PERSON } } },
      booking: { select: { scheduledStartAt: true, request: { select: { title: true, category: { select: { id: true, name: true } }, address: { select: { city: true, district: true } } } } } },
      payments: { orderBy: { createdAt: 'desc' as const }, take: 5, select: { provider: true, status: true } },
      _count: { select: { workProofs: true, cases: true, payments: true } },
    } satisfies Prisma.OrderSelect;
    const shape = ({ master, booking, payments, ...order }: Prisma.OrderGetPayload<{ select: typeof select }>) => ({
      ...order,
      payment: payments.find((row) => row.status === 'SUCCEEDED') ?? payments[0] ?? null,
      master,
      title: booking.request.title,
      category: booking.request.category,
      city: booking.request.address?.city ?? null,
      district: booking.request.address?.district ?? null,
      scheduledStartAt: booking.scheduledStartAt,
    });

    if (query.page) {
      const limit = query.limit ?? 20;
      const [total, rows] = await Promise.all([
        this.db.order.count({ where }),
        this.db.order.findMany({ where, orderBy, select, skip: (query.page - 1) * limit, take: limit }),
      ]);
      return { items: rows.map(shape), total, page: query.page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
    }
    const rows = await this.db.order.findMany({ where, orderBy, select, ...cursorArgs(query) });
    const page = toCursorPage(rows, query);
    return { ...page, items: page.items.map(shape) };
  }

  /** Holatlar bo‘yicha umumiy sonlar va daromad ko‘rsatkichlari (filtrlar bilan bog‘liq emas) + oxirgi 7 kunning oldingi 7 kunga nisbatan o‘zgarishi. */
  async summary() {
    const day = 86_400_000;
    const now = Date.now();
    const last7 = new Date(now - 7 * day);
    const prev7 = new Date(now - 14 * day);
    const flaggedWhere: Prisma.OrderWhereInput = { OR: [{ status: 'DISPUTED' }, { cases: { some: { status: { in: ['REPORTED', 'UNDER_REVIEW'] } } } }] };
    const [byStatus, revenue, flagged, created7, createdPrev7, active7, activePrev7, flagged7, flaggedPrev7, done7, donePrev7, amount7, amountPrev7, weekAgoTotal] = await Promise.all([
      this.db.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.db.order.aggregate({ where: { status: 'COMPLETED' }, _sum: { finalAmount: true, platformFee: true } }),
      this.db.order.count({ where: flaggedWhere }),
      this.db.order.count({ where: { createdAt: { gte: last7 } } }),
      this.db.order.count({ where: { createdAt: { gte: prev7, lt: last7 } } }),
      this.db.order.count({ where: { status: { in: ACTIVE }, createdAt: { gte: last7 } } }),
      this.db.order.count({ where: { status: { in: ACTIVE }, createdAt: { gte: prev7, lt: last7 } } }),
      this.db.order.count({ where: { AND: [flaggedWhere, { createdAt: { gte: last7 } }] } }),
      this.db.order.count({ where: { AND: [flaggedWhere, { createdAt: { gte: prev7, lt: last7 } }] } }),
      this.db.order.count({ where: { status: 'COMPLETED', completedAt: { gte: last7 } } }),
      this.db.order.count({ where: { status: 'COMPLETED', completedAt: { gte: prev7, lt: last7 } } }),
      this.db.order.aggregate({ where: { status: 'COMPLETED', completedAt: { gte: last7 } }, _sum: { finalAmount: true } }),
      this.db.order.aggregate({ where: { status: 'COMPLETED', completedAt: { gte: prev7, lt: last7 } }, _sum: { finalAmount: true } }),
      this.db.order.count({ where: { createdAt: { lt: last7 } } }),
    ]);
    const counts = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all]));
    const total = byStatus.reduce((sum, row) => sum + row._count._all, 0);
    const pair = (current: number, previous: number) => ({ current, previous, changePercent: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null });
    return {
      total,
      counts,
      active: ACTIVE.reduce((sum, status) => sum + (counts[status] ?? 0), 0),
      flagged,
      completedAmount: revenue._sum.finalAmount ?? 0,
      platformFee: revenue._sum.platformFee ?? 0,
      weekAgoTotal,
      trends: {
        created: pair(created7, createdPrev7),
        active: pair(active7, activePrev7),
        flagged: pair(flagged7, flaggedPrev7),
        completed: pair(done7, donePrev7),
        amount: pair(Number(amount7._sum.finalAmount ?? 0), Number(amountPrev7._sum.finalAmount ?? 0)),
      },
    };
  }

  /** Filtr ro‘yxatlari uchun: buyurtmalarda uchraydigan xizmat turlari va hududlar (soni bilan). */
  async facets() {
    const [categories, cities] = await Promise.all([
      this.db.$queryRaw<Array<{ id: string; name: string; count: number }>>`
        SELECT c.id::text AS id, c.name AS name, COUNT(o.id)::int AS count
        FROM orders o
        JOIN bookings b ON b.id = o."bookingId"
        JOIN problem_requests r ON r.id = b."requestId"
        JOIN service_categories c ON c.id = r."categoryId"
        GROUP BY c.id, c.name
        ORDER BY count DESC, c.name ASC
      `,
      this.db.$queryRaw<Array<{ name: string; count: number }>>`
        SELECT a.city AS name, COUNT(o.id)::int AS count
        FROM orders o
        JOIN bookings b ON b.id = o."bookingId"
        JOIN problem_requests r ON r.id = b."requestId"
        JOIN addresses a ON a.id = r."addressId"
        WHERE a.city IS NOT NULL AND a.city <> ''
        GROUP BY a.city
        ORDER BY count DESC, a.city ASC
      `,
    ]);
    return { categories, cities };
  }

  /** Bir nechta buyurtmani birdan bekor qiladi (faqat band qilingan/tasdiqlanganlar); har biri uchun audit yoziladi. */
  async bulkCancel(adminId: string, ids: string[], reason: string) {
    const unique = [...new Set(ids)].slice(0, 100);
    const failed: Array<{ id: string; message: string }> = [];
    let cancelled = 0;
    for (const id of unique) {
      try {
        await this.cancel(adminId, id, reason);
        cancelled += 1;
      } catch (error) {
        failed.push({ id, message: error instanceof Error ? error.message : String(error) });
      }
    }
    return { cancelled, failed };
  }

  async findOne(orderId: string) {
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: PERSON },
        master: { select: { id: true, profession: true, ratingAvg: true, completedOrders: true, user: { select: PERSON } } },
        booking: { include: { request: { include: { category: { select: { name: true } }, address: true } }, offer: { select: { id: true, price: true, message: true, estimatedMinutes: true, createdAt: true } } } },
        statusHistory: { orderBy: { createdAt: 'asc' }, include: { actor: { select: PERSON } } },
        workProofs: { orderBy: { createdAt: 'asc' }, include: { uploadedBy: { select: PERSON } } },
        additionalWork: { orderBy: { requestedAt: 'asc' }, include: { requestedBy: { select: PERSON } } },
        payments: { orderBy: { createdAt: 'asc' }, include: { refunds: true } },
        review: { include: { author: { select: PERSON } } },
        warranty: true,
        cases: { orderBy: { createdAt: 'desc' } },
        conversation: { select: { id: true } },
      },
    });
    if (!order) throw new NotFoundException(ERRORS.ORDER_NOT_FOUND);

    // Mijoz so‘rovga biriktirgan rasm/fayllar (media pipeline orqali yuklangan).
    const requestAssets = await this.db.mediaAsset.findMany({
      where: { linkedResourceType: 'ProblemRequest', linkedResourceId: order.booking.requestId, status: 'READY' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, originalName: true, detectedMimeType: true, sizeBytes: true, createdAt: true },
    });
    const proofAssetIds = order.workProofs.map((proof) => proof.mediaAssetId).filter((id): id is string => !!id);
    const proofAssets = proofAssetIds.length
      ? await this.db.mediaAsset.findMany({ where: { id: { in: proofAssetIds } }, select: { id: true, originalName: true, detectedMimeType: true, sizeBytes: true, status: true } })
      : [];
    const assetById = new Map(proofAssets.map((asset) => [asset.id, asset]));

    const before = { OR: [{ createdAt: { lt: order.createdAt } }, { createdAt: order.createdAt, orderNumber: { lte: order.orderNumber } }] };
    const [customerOrderIndex, masterOrderIndex] = await Promise.all([
      this.db.order.count({ where: { customerId: order.customerId, ...before } }),
      this.db.order.count({ where: { masterId: order.masterId, ...before } }),
    ]);

    return {
      ...order,
      customerOrderIndex,
      masterOrderIndex,
      workProofs: order.workProofs.map((proof) => ({ ...proof, asset: proof.mediaAssetId ? (assetById.get(proof.mediaAssetId) ?? null) : null })),
      requestAssets,
      conversationId: order.conversation?.id ?? (await findPairConversation(this.db, order.customerId, order.master.user.id))?.id ?? null,
      allowedActions: this.allowedActions(order.status),
    };
  }

  private allowedActions(status: OrderStatus) {
    return {
      cancel: status === 'BOOKED' || status === 'CONFIRMED',
      resolve: status === 'DISPUTED',
    };
  }

  async cancel(adminId: string, orderId: string, reason: string) {
    await this.assertExists(orderId);
    const updated = await this.orders.adminCancel(adminId, orderId, reason);
    await this.audit(adminId, 'ADMIN_ORDER_CANCELLED', orderId, reason, updated.status);
    return updated;
  }

  async resolve(adminId: string, orderId: string, decision: 'COMPLETE' | 'CANCEL', reason: string) {
    const order = await this.assertExists(orderId);
    if (order.status !== 'DISPUTED') throw new ConflictException('Faqat nizoli buyurtma bo‘yicha qaror qabul qilinadi');
    const updated = await this.orders.adminResolveDispute(adminId, orderId, decision, reason);
    await this.audit(adminId, decision === 'COMPLETE' ? 'ADMIN_ORDER_COMPLETED' : 'ADMIN_ORDER_CANCELLED', orderId, reason, updated.status, order.status);
    return updated;
  }

  private async assertExists(orderId: string) {
    const order = await this.db.order.findUnique({ where: { id: orderId }, select: { id: true, status: true } });
    if (!order) throw new NotFoundException(ERRORS.ORDER_NOT_FOUND);
    return order;
  }

  private audit(actorId: string, action: string, orderId: string, reason: string, after: OrderStatus, before?: OrderStatus) {
    return this.db.auditLog.create({
      data: { actorId, action, targetType: 'Order', targetId: orderId, reason, before: before ? { status: before } : undefined, after: { status: after } },
    });
  }
}
