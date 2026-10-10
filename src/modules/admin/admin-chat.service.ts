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
    const numeric = search && /^\d+$/.test(search) ? Number(search) : undefined;
    const where: Prisma.ConversationWhereInput = {
      type: query.type,
      ...(search
        ? {
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
          }
        : {}),
    };
    const rows = await this.db.conversation.findMany({
      where,
      include: {
        participants: { select: { roles: true, deletedAt: true, user: { select: PERSON } } },
        order: { select: { id: true, status: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { text: true, createdAt: true, deletedAt: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
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
      items: page.items.map(({ messages, _count, ...conversation }) => ({
        ...conversation,
        lastMessage: messages[0] ?? null,
        messageCount: _count.messages,
        deletedCount: deletedBy.get(conversation.id) ?? 0,
        editedCount: editedBy.get(conversation.id) ?? 0,
      })),
      nextCursor: page.nextCursor,
    };
  }

  async findOne(conversationId: string) {
    const conversation = await this.db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: { select: { roles: true, deletedAt: true, user: { select: PERSON } } },
        order: { select: { id: true, status: true } },
      },
    });
    if (!conversation) throw new NotFoundException(ERRORS.CONVERSATION_NOT_FOUND);
    return conversation;
  }

  async findMessages(conversationId: string, query: CursorQueryDto) {
    await this.findOne(conversationId);
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
