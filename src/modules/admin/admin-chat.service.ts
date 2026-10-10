import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERRORS } from '../../common/constants/error-messages';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { CursorQueryDto } from '../../common/dto/cursor-query.dto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AdminConversationQueryDto } from './dto/chat-query.dto';

const PERSON = { id: true, accountNumber: true, firstName: true, lastName: true, avatarAssetId: true, phone: true } as const;

@Injectable()
export class AdminChatService {
  constructor(private readonly db: PrismaService) {}

  async findAll(query: AdminConversationQueryDto) {
    const search = query.search?.trim();
    const numeric = search && /^#?\d+$/.test(search) ? Number(search.replace('#', '')) : undefined;
    const and: Prisma.ConversationWhereInput[] = [];
    if (search) {
      and.push({
        OR: [
          {
            participants: {
              some: {
                user: {
                  OR: [
                    { phone: { contains: search } },
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                    ...(numeric !== undefined && numeric < 2_000_000_000 ? [{ accountNumber: numeric }] : []),
                  ],
                },
              },
            },
          },
          ...(numeric !== undefined && numeric < 2_000_000_000 ? [{ order: { orderNumber: numeric } }] : []),
        ],
      });
    }
    if (query.flag === 'deleted') and.push({ messages: { some: { deletedAt: { not: null } } } });
    if (query.flag === 'edited') and.push({ messages: { some: { edits: { some: {} } } } });
    if (query.flag === 'files') and.push({ messages: { some: { attachments: { not: Prisma.JsonNull } } } });
    if (query.flag === 'disputed') and.push({ order: { OR: [{ status: 'DISPUTED' }, { cases: { some: {} } }] } });
    const where: Prisma.ConversationWhereInput = { type: query.type, ...(query.orderStatus ? { order: { status: query.orderStatus } } : {}), ...(and.length ? { AND: and } : {}) };
    const orderBy: Prisma.ConversationOrderByWithRelationInput[] =
      query.sort === 'oldest' ? [{ updatedAt: 'asc' }, { id: 'asc' }] : query.sort === 'messages' ? [{ messages: { _count: 'desc' } }, { id: 'asc' }] : [{ updatedAt: 'desc' }, { id: 'asc' }];
    const rows = await this.db.conversation.findMany({
      where,
      include: {
        participants: { select: { roles: true, deletedAt: true, user: { select: PERSON } } },
        order: { select: { id: true, status: true, orderNumber: true, finalAmount: true, currency: true, _count: { select: { cases: true } }, booking: { select: { request: { select: { category: { select: { name: true } } } } } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { text: true, createdAt: true, deletedAt: true, attachments: true } },
        _count: { select: { messages: true } },
      },
      orderBy,
      ...cursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    const ids = page.items.map((item) => item.id);
    const [deleted, edited] = await Promise.all([
      this.db.message.groupBy({ by: ['conversationId'], where: { conversationId: { in: ids }, deletedAt: { not: null } }, _count: true }),
      this.db.message.groupBy({ by: ['conversationId'], where: { conversationId: { in: ids }, edits: { some: {} } }, _count: true }),
    ]);
    const deletedBy = new Map(deleted.map((row) => [row.conversationId, row._count]));
    const editedBy = new Map(edited.map((row) => [row.conversationId, row._count]));
    return {
      items: page.items.map(({ messages, _count, order, ...conversation }) => ({
        ...conversation,
        order: order ? { id: order.id, status: order.status, orderNumber: order.orderNumber, finalAmount: order.finalAmount, currency: order.currency, casesCount: order._count.cases, category: order.booking.request.category?.name ?? null } : null,
        lastMessage: messages[0] ? { text: messages[0].text, createdAt: messages[0].createdAt, deletedAt: messages[0].deletedAt, hasAttachments: Array.isArray(messages[0].attachments) && messages[0].attachments.length > 0 } : null,
        messageCount: _count.messages,
        deletedCount: deletedBy.get(conversation.id) ?? 0,
        editedCount: editedBy.get(conversation.id) ?? 0,
      })),
      nextCursor: page.nextCursor,
    };
  }

  /** Ro‘yxat yuqorisidagi tablar uchun sonlar. */
  async stats() {
    const [total, order, direct, support, disputed, withDeleted, withEdited, messages] = await Promise.all([
      this.db.conversation.count(),
      this.db.conversation.count({ where: { type: 'ORDER' } }),
      this.db.conversation.count({ where: { type: 'DIRECT' } }),
      this.db.conversation.count({ where: { type: 'SUPPORT' } }),
      this.db.conversation.count({ where: { order: { OR: [{ status: 'DISPUTED' }, { cases: { some: {} } }] } } }),
      this.db.conversation.count({ where: { messages: { some: { deletedAt: { not: null } } } } }),
      this.db.conversation.count({ where: { messages: { some: { edits: { some: {} } } } } }),
      this.db.message.count(),
    ]);
    return { total, order, direct, support, disputed, withDeleted, withEdited, messages };
  }

  async findOne(conversationId: string) {
    const conversation = await this.db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: { select: { roles: true, deletedAt: true, lastReadAt: true, joinedAt: true, user: { select: { ...PERSON, email: true, status: true, masterProfile: { select: { profession: true, ratingAvg: true, ratingCount: true } } } } } },
        order: {
          select: {
            id: true,
            status: true,
            orderNumber: true,
            finalAmount: true,
            currency: true,
            createdAt: true,
            cases: { orderBy: { createdAt: 'desc' }, select: { id: true, type: true, title: true, status: true, createdAt: true } },
            payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { provider: true, status: true } },
            booking: { select: { request: { select: { title: true, category: { select: { name: true } }, address: { select: { city: true, district: true } } } } } },
          },
        },
      },
    });
    if (!conversation) throw new NotFoundException(ERRORS.CONVERSATION_NOT_FOUND);
    const { order, ...rest } = conversation;
    return {
      ...rest,
      order: order
        ? { id: order.id, status: order.status, orderNumber: order.orderNumber, finalAmount: order.finalAmount, currency: order.currency, createdAt: order.createdAt, cases: order.cases, payment: order.payments[0] ?? null, title: order.booking.request.title, category: order.booking.request.category?.name ?? null, city: order.booking.request.address?.city ?? null, district: order.booking.request.address?.district ?? null }
        : null,
    };
  }

  /** Suhbatdagi barcha fayllar (xabarlardagi ilovalar), yangilari birinchi. */
  async files(conversationId: string) {
    await this.assertExists(conversationId);
    const rows = await this.db.message.findMany({
      where: { conversationId, attachments: { not: Prisma.JsonNull } },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: { id: true, createdAt: true, deletedAt: true, sender: { select: PERSON }, attachments: true },
    });
    const files = rows.flatMap((row) =>
      (Array.isArray(row.attachments) ? (row.attachments as Array<{ mediaAssetId?: string; mimeType?: string; name?: string }>) : [])
        .filter((file) => !!file.mediaAssetId)
        .map((file) => ({ mediaAssetId: file.mediaAssetId as string, mimeType: file.mimeType ?? '', name: file.name ?? '', messageId: row.id, createdAt: row.createdAt, messageDeletedAt: row.deletedAt, sender: row.sender })),
    );
    return { items: files };
  }

  /** Suhbat tarixi: boshlanishi, o‘chirish/tahrirlash hodisalari, qo‘ng‘iroqlar va buyurtma holatlari o‘zgarishi. */
  async timeline(conversationId: string) {
    const conversation = await this.db.conversation.findUnique({ where: { id: conversationId }, select: { id: true, createdAt: true, orderId: true, type: true } });
    if (!conversation) throw new NotFoundException(ERRORS.CONVERSATION_NOT_FOUND);
    const [first, deleted, edits, calls, history] = await Promise.all([
      this.db.message.findFirst({ where: { conversationId }, orderBy: { createdAt: 'asc' }, select: { createdAt: true, sender: { select: PERSON } } }),
      this.db.message.findMany({ where: { conversationId, deletedAt: { not: null } }, orderBy: { deletedAt: 'desc' }, take: 50, select: { id: true, deletedAt: true, sender: { select: PERSON } } }),
      this.db.messageEdit.findMany({ where: { message: { conversationId } }, orderBy: { editedAt: 'desc' }, take: 50, select: { id: true, editedAt: true, message: { select: { sender: { select: PERSON } } } } }),
      this.db.call.findMany({ where: { conversationId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, mode: true, status: true, createdAt: true, answeredAt: true, endedAt: true, caller: { select: PERSON } } }),
      conversation.orderId ? this.db.orderStatusHistory.findMany({ where: { orderId: conversation.orderId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, newStatus: true, reason: true, createdAt: true } }) : Promise.resolve([]),
    ]);
    const events: Array<{ id: string; kind: 'created' | 'first_message' | 'deleted' | 'edited' | 'call' | 'order_status'; at: Date; actor: unknown; detail: Record<string, unknown> }> = [
      { id: `created-${conversation.id}`, kind: 'created', at: conversation.createdAt, actor: null, detail: { type: conversation.type } },
      ...(first ? [{ id: 'first', kind: 'first_message' as const, at: first.createdAt, actor: first.sender, detail: {} }] : []),
      ...deleted.map((row) => ({ id: `del-${row.id}`, kind: 'deleted' as const, at: row.deletedAt as Date, actor: row.sender, detail: { messageId: row.id } })),
      ...edits.map((row) => ({ id: `edit-${row.id}`, kind: 'edited' as const, at: row.editedAt, actor: row.message.sender, detail: {} })),
      ...calls.map((row) => ({ id: `call-${row.id}`, kind: 'call' as const, at: row.createdAt, actor: row.caller, detail: { mode: row.mode, status: row.status, seconds: row.answeredAt && row.endedAt ? Math.round((row.endedAt.getTime() - row.answeredAt.getTime()) / 1000) : null } })),
      ...history.map((row) => ({ id: `ord-${row.id}`, kind: 'order_status' as const, at: row.createdAt, actor: null, detail: { status: row.newStatus, reason: row.reason } })),
    ];
    events.sort((a, b) => b.at.getTime() - a.at.getTime());
    return { items: events.slice(0, 120) };
  }

  private async assertExists(conversationId: string) {
    const found = await this.db.conversation.findUnique({ where: { id: conversationId }, select: { id: true } });
    if (!found) throw new NotFoundException(ERRORS.CONVERSATION_NOT_FOUND);
  }

  async findMessages(conversationId: string, query: CursorQueryDto) {
    await this.assertExists(conversationId);
    const rows = await this.db.message.findMany({
      where: { conversationId },
      select: {
        id: true,
        senderId: true,
        senderPanel: true,
        type: true,
        text: true,
        attachments: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
        sender: { select: PERSON },
        replyTo: { select: { id: true, text: true, deletedAt: true } },
        reactions: { orderBy: { createdAt: 'asc' }, select: { emoji: true, userId: true, panel: true, createdAt: true } },
        edits: { orderBy: { editedAt: 'asc' }, select: { id: true, previousText: true, editedAt: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query),
    });
    return toCursorPage(rows, query);
  }
}
