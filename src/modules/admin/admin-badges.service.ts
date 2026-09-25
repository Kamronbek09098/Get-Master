import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AdminBadgesQueryDto } from './dto/badges-query.dto';

const after = (since?: string) => (since ? { gt: new Date(since) } : undefined);

/** Admin menyusidagi belgilar: faqat oxirgi kirishdan keyin paydo bo‘lgan yangi ishlar va faollik. */
@Injectable()
export class AdminBadgesService {
  constructor(private readonly db: PrismaService) {}

  async get(query: AdminBadgesQueryDto) {
    const [verifications, portfolio, cases, appeals, users, chats, orders] = await Promise.all([
      query.verificationsSince
        ? this.db.masterVerification.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] }, createdAt: after(query.verificationsSince) } })
        : 0,
      query.verificationsSince ? this.db.masterPortfolio.count({ where: { status: 'PENDING', createdAt: after(query.verificationsSince) } }) : 0,
      query.casesSince ? this.db.case.count({ where: { status: { in: ['REPORTED', 'UNDER_REVIEW'] }, createdAt: after(query.casesSince) } }) : 0,
      query.appealsSince ? this.db.appeal.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] }, createdAt: after(query.appealsSince) } }) : 0,
      query.usersSince ? this.db.user.count({ where: { createdAt: after(query.usersSince), deletedAt: null } }) : 0,
      query.chatsSince ? this.db.message.count({ where: { createdAt: after(query.chatsSince) } }) : 0,
      query.ordersSince ? this.db.order.count({ where: { createdAt: after(query.ordersSince) } }) : 0,
    ]);
    return { verifications: verifications + portfolio, cases, appeals, users, chats, orders, now: new Date().toISOString() };
  }
}
