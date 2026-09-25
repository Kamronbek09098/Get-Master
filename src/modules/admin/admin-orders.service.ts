import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { ERRORS } from '../../common/constants/error-messages';
import { cursorArgs, dateRangeWhere, toCursorPage } from '../../common/utils/cursor';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderService } from '../order/order.service';
import { AdminOrderQueryDto } from './dto/order-query.dto';

const PERSON = { id: true, accountNumber: true, firstName: true, lastName: true, phone: true } as const;
const ACTIVE: OrderStatus[] = ['BOOKED', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'WAITING_CONFIRMATION', 'DISPUTED'];

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly db: PrismaService,
    private readonly orders: OrderService,
  ) {}

  /** Buyurtma ID ning boshlanishi bo‘yicha qidirish (UUID ustunida startsWith yo‘q). */
  private async idsByPrefix(prefix: string): Promise<string[]> {
    const rows = await this.db.$queryRaw<Array<{ id: string }>>`SELECT id::text AS id FROM orders WHERE id::text LIKE ${prefix.toLowerCase() + '%'} LIMIT 50`;
    return rows.map((row) => row.id);
  }

  async findAll(query: AdminOrderQueryDto) {
    const search = query.search?.trim();
    const idMatches = search && /^[0-9a-f-]{4,36}$/i.test(search) ? await this.idsByPrefix(search) : [];
    const where: Prisma.OrderWhereInput = {
      status: query.status,
      createdAt: dateRangeWhere(query),
      ...(query.flagged ? { OR: [{ status: 'DISPUTED' }, { cases: { some: { status: { in: ['REPORTED', 'UNDER_REVIEW'] } } } }] } : {}),
      ...(search
        ? {
            AND: [
              {
                OR: [
                  ...(idMatches.length ? [{ id: { in: idMatches } }] : []),
                  { customer: { OR: [{ phone: { contains: search } }, { firstName: { contains: search, mode: 'insensitive' as const } }, { lastName: { contains: search, mode: 'insensitive' as const } }] } },
                  { master: { user: { OR: [{ phone: { contains: search } }, { firstName: { contains: search, mode: 'insensitive' as const } }, { lastName: { contains: search, mode: 'insensitive' as const } }] } } },
                  { booking: { request: { title: { contains: search, mode: 'insensitive' as const } } } },
                ],
              },
            ],
          }
        : {}),
    };
    const rows = await this.db.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        status: true,
        finalAmount: true,
        currency: true,
        createdAt: true,
        completedAt: true,
        cancelledAt: true,
        customer: { select: PERSON },
        master: { select: { id: true, profession: true, user: { select: PERSON } } },
        booking: { select: { scheduledStartAt: true, request: { select: { title: true } } } },
        _count: { select: { workProofs: true, cases: true, payments: true } },
      },
      ...cursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    return { ...page, items: page.items.map(({ master, booking, ...order }) => ({ ...order, master: { ...master, user: master.user }, title: booking.request.title, scheduledStartAt: booking.scheduledStartAt })) };
  }

  /** Holatlar bo‘yicha umumiy sonlar va daromad ko‘rsatkichlari (filtrlar bilan bog‘liq emas). */
  async summary() {
    const [byStatus, revenue, flagged] = await Promise.all([
      this.db.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.db.order.aggregate({ where: { status: 'COMPLETED' }, _sum: { finalAmount: true, platformFee: true } }),
      this.db.order.count({ where: { OR: [{ status: 'DISPUTED' }, { cases: { some: { status: { in: ['REPORTED', 'UNDER_REVIEW'] } } } }] } }),
    ]);
    const counts = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all]));
    const total = byStatus.reduce((sum, row) => sum + row._count._all, 0);
    return {
      total,
      counts,
      active: ACTIVE.reduce((sum, status) => sum + (counts[status] ?? 0), 0),
      flagged,
      completedAmount: revenue._sum.finalAmount ?? 0,
      platformFee: revenue._sum.platformFee ?? 0,
    };
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

    return {
      ...order,
      workProofs: order.workProofs.map((proof) => ({ ...proof, asset: proof.mediaAssetId ? (assetById.get(proof.mediaAssetId) ?? null) : null })),
      requestAssets,
      conversationId: order.conversation?.id ?? null,
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
