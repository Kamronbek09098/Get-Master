import { Panel } from '../../common/utils/panel';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MessageType, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { CursorQueryDto } from '../../common/dto/cursor-query.dto';
import { NotificationService } from '../notification/notification.service';
import { OrderService } from '../order/order.service';
import { EditMessageDto, SendMessageDto } from './dto/message.dto';
import { ERRORS } from '../../common/constants/error-messages';

const EDIT_WINDOW_MS = 48 * 60 * 60_000;

const CLOSED_ORDER_STATUSES: OrderStatus[] = ['CANCELLED', 'EXPIRED'];

const USER_NAME_SELECT = { id: true, accountNumber: true, firstName: true, lastName: true } as const;

const holdsPanel = (roles: string[], panel: Panel | null): boolean =>
  !panel || panel === 'ADMIN' || roles.length === 0 || roles.includes(panel);

interface StoredAttachment {
  mediaAssetId: string;
  mimeType: string;
  name: string;
}

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly orders: OrderService,
    private readonly notifications: NotificationService,
  ) {}

  async create(userId: string, orderId: string, panel: Panel | null = null) {
    const order = await this.orders.getOrderParticipants(orderId);
    if (userId !== order.customerId && userId !== order.masterUserId) {
      throw new ForbiddenException(ERRORS.NOT_ORDER_PARTICIPANT);
    }
    const existing = await this.db.conversation.findUnique({ where: { orderId } });
    if (existing) return this.findOne(userId, existing.id, panel);
    try {
      const created = await this.db.conversation.create({
        data: {
          type: 'ORDER',
          orderId,
          participants: {
            create: [...new Set([order.customerId, order.masterUserId])].map((id) => ({
              userId: id,
              roles: [...(id === order.customerId ? ['CUSTOMER'] : []), ...(id === order.masterUserId ? ['MASTER'] : [])],
            })),
          },
        },
      });
      return this.findOne(userId, created.id, panel);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.db.conversation.findUniqueOrThrow({ where: { orderId } });
        return this.findOne(userId, raced.id, panel);
      }
      throw error;
    }
  }

  /** Mijoz va usta o‘rtasida buyurtmadan oldingi suhbat: har bir juftlik uchun bitta (qayta bosilsa, mavjudi qaytadi). */
  async openDirect(userId: string, masterId: string, panel: Panel | null = null) {
    const master = await this.db.masterProfile.findFirst({
      where: { id: masterId, status: 'ACTIVE', verification: 'VERIFIED', user: { status: 'ACTIVE', deletedAt: null } },
      select: { userId: true },
    });
    if (!master) throw new NotFoundException(ERRORS.MASTER_NOT_FOUND);
    if (master.userId === userId) throw new ForbiddenException(ERRORS.CHAT_WITH_SELF);

    // Ikkovi o‘rtasida allaqachon suhbat bo‘lsa (buyurtma suhbati yoki oldingi to‘g‘ridan-to‘g‘ri suhbat),
    // yangisini yaratmasdan o‘shanga qaytariladi — bitta juftlik uchun bir nechta parallel suhbat bo‘lmasin.
    const candidates = await this.db.conversation.findMany({
      where: { AND: [{ participants: { some: { userId } } }, { participants: { some: { userId: master.userId } } }] },
      include: { order: { select: { status: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
    const writable = candidates.find((c) => !(c.order && CLOSED_ORDER_STATUSES.includes(c.order.status)));
    if (writable) return this.findOne(userId, writable.id, panel);

    const directKey = [userId, master.userId].sort().join(':');
    const existing = await this.db.conversation.findUnique({ where: { directKey } });
    if (existing) return this.findOne(userId, existing.id, panel);
    try {
      const created = await this.db.conversation.create({
        data: {
          type: 'DIRECT',
          directKey,
          participants: { create: [{ userId, roles: ['CUSTOMER'] }, { userId: master.userId, roles: ['MASTER'] }] },
        },
      });
      return this.findOne(userId, created.id, panel);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.db.conversation.findUniqueOrThrow({ where: { directKey } });
        return this.findOne(userId, raced.id, panel);
      }
      throw error;
    }
  }

  /** Barcha suhbatlar bo‘yicha o‘qilmagan xabarlar soni (menyudagi belgi uchun). */
  async unreadTotal(userId: string, panel: Panel | null = null) {
    const mine = await this.db.conversationParticipant.findMany({
      where: { userId, ...(panel && panel !== 'ADMIN' ? { OR: [{ roles: { has: panel } }, { roles: { isEmpty: true } }] } : {}) },
      select: { conversationId: true, lastReadAt: true },
      take: 500,
    });
    const counts = await Promise.all(
      mine.map((row) =>
        this.db.message.count({
          where: {
            conversationId: row.conversationId,
            NOT: { senderId: userId, ...(panel ? { OR: [{ senderPanel: panel }, { senderPanel: null }] } : {}) },
            deletedAt: null,
            ...(row.lastReadAt ? { createdAt: { gt: row.lastReadAt } } : {}),
          },
        }),
      ),
    );
    return { count: counts.reduce((sum, value) => sum + value, 0) };
  }

  async findAll(userId: string, query: CursorQueryDto, panel: Panel | null = null) {
    const rows = await this.db.conversation.findMany({
      where: {
        participants: {
          some: {
            userId,
            ...(panel && panel !== 'ADMIN' ? { OR: [{ roles: { has: panel } }, { roles: { isEmpty: true } }] } : {}),
          },
        },
      },
      include: {
        order: { select: { id: true, status: true } },
        participants: { select: { userId: true, roles: true, lastReadAt: true, deletedAt: true, user: { select: USER_NAME_SELECT } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: this.messageSelect() },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      ...cursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    const counterpartIds = page.items.flatMap((row) => row.participants.filter((p) => p.userId !== userId).map((p) => p.userId));
    const masters = counterpartIds.length ? await this.db.masterProfile.findMany({ where: { userId: { in: counterpartIds } }, select: { userId: true } }) : [];
    const masterUserIds = new Set(masters.map((row) => row.userId));
    const items = await Promise.all(
      page.items
        .filter((row) => row.participants.length > 1)
        // Telegram uslubida: men o'chirgan suhbat ro'yxatimda yashiriladi, faqat o'chirgandan keyin yangi faollik bo'lsa qayta chiqadi.
        .filter((row) => {
          const mine = row.participants.find((p) => p.userId === userId);
          return !mine?.deletedAt || row.updatedAt > mine.deletedAt;
        })
        .map(async ({ messages, participants, ...conversation }) => {
        const mine = participants.find((p) => p.userId === userId);
        const unreadCount = await this.db.message.count({
          where: {
            conversationId: conversation.id,
            NOT: { senderId: userId, ...(panel ? { OR: [{ senderPanel: panel }, { senderPanel: null }] } : {}) },
            deletedAt: null,
            ...(mine?.lastReadAt ? { createdAt: { gt: mine.lastReadAt } } : {}),
          },
        });
        return {
          ...conversation,
          counterpart: (participants.find((p) => p.userId !== userId) ?? mine)?.user ?? null,
          counterpartIsMaster: participants.some((p) => p.userId !== userId && masterUserIds.has(p.userId)),
          counterpartLastReadAt: participants.find((p) => p.userId !== userId)?.lastReadAt ?? null,
          lastMessage: messages[0] ? this.present(messages[0]) : null,
          unreadCount,
        };
      }),
    );
    return { items, nextCursor: page.nextCursor };
  }

  async findOne(userId: string, conversationId: string, panel: Panel | null = null) {
    await this.requireParticipant(userId, conversationId, panel);
    const conversation = await this.db.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: {
        order: { select: { id: true, status: true } },
        participants: { select: { userId: true, roles: true, lastReadAt: true, user: { select: USER_NAME_SELECT } } },
      },
    });
    return conversation;
  }

  async findAllMessages(userId: string, conversationId: string, query: CursorQueryDto, panel: Panel | null = null) {
    await this.requireParticipant(userId, conversationId, panel);
    const rows = await this.db.message.findMany({
      where: { conversationId },
      select: this.messageSelect(),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    return { items: page.items.map((row) => this.present(row)), nextCursor: page.nextCursor };
  }

  async createMessage(userId: string, conversationId: string, dto: SendMessageDto, panel: Panel | null = null) {
    const conversation = await this.requireParticipant(userId, conversationId, panel);
    if (conversation.order && CLOSED_ORDER_STATUSES.includes(conversation.order.status)) {
      throw new ConflictException(ERRORS.CHAT_READ_ONLY(conversation.order.status));
    }
    const text = dto.text?.trim();
    const assetIds = dto.mediaAssetIds ?? [];
    if (!text && assetIds.length === 0) throw new BadRequestException(ERRORS.MESSAGE_EMPTY);
    if (dto.replyToId) {
      const target = await this.db.message.findFirst({ where: { id: dto.replyToId, conversationId }, select: { deletedAt: true } });
      if (!target || target.deletedAt) throw new BadRequestException(ERRORS.REPLY_TARGET_INVALID);
    }

    const message = await this.db.$transaction(async (tx) => {
      const attachments = await this.loadAttachments(tx, userId, conversationId, assetIds);
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          senderPanel: panel,
          replyToId: dto.replyToId,
          type: this.messageType(attachments),
          text: text || null,
          attachments: attachments.length > 0 ? (attachments as unknown as Prisma.InputJsonValue) : undefined,
        },
        select: this.messageSelect(),
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      await tx.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: new Date() },
      });
      return created;
    });

    await this.markChatNotificationsRead(userId, conversationId);
    await this.notifyOthers(userId, conversationId, conversation.participantIds);
    return this.present(message);
  }

  async updateMessage(userId: string, conversationId: string, messageId: string, dto: EditMessageDto, panel: Panel | null = null) {
    await this.requireParticipant(userId, conversationId, panel);
    const message = await this.requireOwnMessage(userId, conversationId, messageId, panel);
    if (message.type === 'SYSTEM') throw new BadRequestException(ERRORS.ONLY_TEXT_EDITABLE);
    if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new ConflictException(ERRORS.EDIT_WINDOW_PASSED);
    }
    const text = dto.text.trim();
    const updated = await this.db.$transaction(async (tx) => {
      await tx.messageEdit.create({ data: { messageId, previousText: message.text } });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'CHAT_MESSAGE_EDITED',
          targetType: 'Message',
          targetId: messageId,
          before: { text: message.text, conversationId },
          after: { text, conversationId },
        },
      });
      return tx.message.update({
        where: { id: messageId },
        data: { text, editedAt: new Date() },
        select: this.messageSelect(),
      });
    });
    return this.present(updated);
  }

  async removeMessage(userId: string, conversationId: string, messageId: string, panel: Panel | null = null) {
    await this.requireParticipant(userId, conversationId, panel);
    const message = await this.requireOwnMessage(userId, conversationId, messageId, panel);
    await this.db.$transaction([
      this.db.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } }),
      this.db.auditLog.create({
        data: {
          actorId: userId,
          action: 'CHAT_MESSAGE_DELETED',
          targetType: 'Message',
          targetId: messageId,
          before: { text: message.text, type: message.type, conversationId },
        },
      }),
    ]);
    return { deleted: true };
  }

  async react(userId: string, conversationId: string, messageId: string, emoji: string | null, panel: Panel | null = null) {
    await this.requireParticipant(userId, conversationId, panel);
    const message = await this.db.message.findFirst({ where: { id: messageId, conversationId }, select: { deletedAt: true } });
    if (!message || message.deletedAt) throw new NotFoundException(ERRORS.MESSAGE_NOT_FOUND);
    const key = { messageId, userId, panel: panel ?? '' };
    if (!emoji) {
      await this.db.messageReaction.deleteMany({ where: key });
    } else {
      await this.db.messageReaction.upsert({
        where: { messageId_userId_panel: key },
        create: { ...key, emoji },
        update: { emoji },
      });
    }
    const reactions = await this.db.messageReaction.findMany({ where: { messageId }, select: { emoji: true, userId: true, panel: true } });
    return { reactions };
  }

  async markRead(userId: string, conversationId: string, panel: Panel | null = null) {
    await this.requireParticipant(userId, conversationId, panel);
    const lastReadAt = new Date();
    await this.db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt },
    });
    await this.markChatNotificationsRead(userId, conversationId);
    return { lastReadAt };
  }

  /**
   * Telegram uslubida suhbatni o'chirish: faqat shu foydalanuvchining ro'yxatidan yashiriladi,
   * xabarlar o'zgarmaydi va boshqa tomon (yoki admin) hech narsani yo'qotmaydi. Suhbatda keyinroq
   * yangi xabar kelsa (kim yozishidan qat'i nazar), suhbat ro'yxatda avtomatik qayta paydo bo'ladi.
   */
  async deleteForMe(userId: string, conversationId: string, panel: Panel | null = null) {
    await this.requireParticipant(userId, conversationId, panel);
    await this.db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  /** Suhbat o‘qilgach, undagi «Yangi xabar» bildirishnomalari ham o‘qilgan bo‘lsin (bildirishnomani ochmasdan ham). */
  private async markChatNotificationsRead(userId: string, conversationId: string) {
    await this.db.notification
      .updateMany({
        where: { userId, template: 'chat.message', status: { not: 'READ' }, data: { path: ['conversationId'], equals: conversationId } },
        data: { status: 'READ', readAt: new Date() },
      })
      .catch(() => undefined);
  }

  private async requireParticipant(userId: string, conversationId: string, panel: Panel | null = null) {
    const conversation = await this.db.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        order: { select: { status: true } },
        participants: { select: { userId: true, roles: true } },
      },
    });
    if (!conversation) throw new NotFoundException(ERRORS.CONVERSATION_NOT_FOUND);
    const participantIds = conversation.participants.map((p) => p.userId);
    if (conversation.participants.length < 2) throw new NotFoundException(ERRORS.CONVERSATION_NOT_FOUND);
    const own = conversation.participants.find((p) => p.userId === userId);
    if (!own || !holdsPanel(own.roles, panel)) throw new ForbiddenException(ERRORS.NOT_CONVERSATION_PARTICIPANT);
    return { id: conversation.id, order: conversation.order, participantIds };
  }

  private async requireOwnMessage(userId: string, conversationId: string, messageId: string, panel: Panel | null) {
    const message = await this.db.message.findFirst({ where: { id: messageId, conversationId } });
    if (!message || message.deletedAt) throw new NotFoundException(ERRORS.MESSAGE_NOT_FOUND);
    if (message.senderId !== userId || (panel && message.senderPanel && message.senderPanel !== panel)) throw new ForbiddenException(ERRORS.NOT_MESSAGE_AUTHOR);
    return message;
  }

  private async loadAttachments(
    tx: Prisma.TransactionClient,
    userId: string,
    conversationId: string,
    assetIds: string[],
  ): Promise<StoredAttachment[]> {
    if (assetIds.length === 0) return [];
    const assets = await tx.mediaAsset.findMany({ where: { id: { in: assetIds } } });
    if (assets.length !== assetIds.length) throw new ForbiddenException(ERRORS.MEDIA_UNKNOWN_ATTACHMENT);
    return assets.map((asset) => {
      if (
        asset.kind !== 'MESSAGE_ATTACHMENT' ||
        asset.uploaderId !== userId ||
        asset.linkedResourceType !== 'Conversation' ||
        asset.linkedResourceId !== conversationId
      ) {
        throw new ForbiddenException(ERRORS.MEDIA_NOT_CONVERSATION);
      }
      if (asset.status !== 'READY') throw new ConflictException(ERRORS.MEDIA_NOT_READY(asset.status));
      return { mediaAssetId: asset.id, mimeType: asset.detectedMimeType ?? 'application/octet-stream', name: asset.originalName };
    });
  }

  private messageType(attachments: StoredAttachment[]): MessageType {
    if (attachments.length === 0) return 'TEXT';
    if (attachments.every((a) => a.mimeType.startsWith('image/'))) return 'IMAGE';
    if (attachments.every((a) => a.mimeType.startsWith('video/'))) return 'VIDEO';
    return 'FILE';
  }

  private messageSelect() {
    return {
      id: true,
      conversationId: true,
      senderId: true,
      senderPanel: true,
      type: true,
      orderId: true,
      text: true,
      attachments: true,
      createdAt: true,
      editedAt: true,
      deletedAt: true,
      replyTo: {
        select: {
          id: true,
          text: true,
          type: true,
          deletedAt: true,
          senderId: true,
          senderPanel: true,
          sender: { select: { id: true, accountNumber: true, firstName: true, lastName: true } },
        },
      },
      reactions: { select: { emoji: true, userId: true, panel: true } },
    } satisfies Prisma.MessageSelect;
  }

  private maskReply<T extends object>(message: T): T {
    const reply = (message as { replyTo?: { text: string | null; deletedAt: Date | null } | null }).replyTo;
    if (!reply?.deletedAt) return message;
    return { ...message, replyTo: { ...reply, text: null } };
  }

  private present<T extends { text: string | null; attachments: Prisma.JsonValue | null; deletedAt: Date | null }>(
    message: T,
  ): T & { deleted: boolean } {
    const shaped = this.maskReply(message);
    if (!message.deletedAt) return { ...shaped, deleted: false };
    return { ...shaped, text: null, attachments: null, deleted: true, reactions: [], replyTo: null };
  }

  private async notifyOthers(senderId: string, conversationId: string, participantIds: string[]) {
    const sender = await this.db.user.findUnique({ where: { id: senderId }, select: { firstName: true } });
    await Promise.all(
      participantIds
        .filter((id) => id !== senderId)
        .map((userId) =>
          this.notifications
            .create({
              userId,
              channel: 'IN_APP',
              title: 'Yangi xabar',
              body: `${sender?.firstName ?? 'Foydalanuvchi'} sizga xabar yubordi.`,
              template: 'chat.message',
              data: { conversationId },
            })
            .catch((error: unknown) => this.logger.warn(`Chat bildirishnomasini yuborib bo‘lmadi: ${String(error)}`)),
        ),
    );
  }
}
