import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PortfolioStatus } from '@prisma/client';
import { ERRORS } from '../../common/constants/error-messages';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { PortfolioQueryDto, ReviewPortfolioDto } from './dto/portfolio-review.dto';

@Injectable()
export class AdminPortfolioService {
  private readonly logger = new Logger(AdminPortfolioService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async findAll(query: PortfolioQueryDto) {
    const rows = await this.db.masterPortfolio.findMany({
      where: { status: query.status ?? PortfolioStatus.PENDING },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        mediaAssetId: true,
        rejectReason: true,
        reviewedAt: true,
        createdAt: true,
        master: {
          select: { id: true, profession: true, user: { select: { accountNumber: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      ...cursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  async review(adminId: string, itemId: string, dto: ReviewPortfolioDto) {
    const item = await this.db.masterPortfolio.findUnique({
      where: { id: itemId },
      select: { id: true, title: true, status: true, master: { select: { userId: true } } },
    });
    if (!item) throw new NotFoundException(ERRORS.PORTFOLIO_ITEM_NOT_FOUND);
    if (item.status !== PortfolioStatus.PENDING) throw new ConflictException(ERRORS.PORTFOLIO_ALREADY_REVIEWED);

    const approved = dto.decision === 'APPROVE';
    const updated = await this.db.$transaction(async (tx) => {
      const result = await tx.masterPortfolio.update({
        where: { id: itemId },
        data: {
          status: approved ? PortfolioStatus.APPROVED : PortfolioStatus.REJECTED,
          reviewedById: adminId,
          reviewedAt: new Date(),
          rejectReason: approved ? null : dto.reason?.trim(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: approved ? 'ADMIN_PORTFOLIO_APPROVED' : 'ADMIN_PORTFOLIO_REJECTED',
          targetType: 'MasterPortfolio',
          targetId: itemId,
          before: { status: item.status },
          after: { status: result.status },
        },
      });
      return result;
    });

    await this.notifications
      .create({
        userId: item.master.userId,
        channel: 'IN_APP',
        title: approved ? 'Portfolio tasdiqlandi' : 'Portfolio rad etildi',
        body: approved
          ? `“${item.title ?? 'Ish namunasi'}” profilingizda ko‘rinadi.`
          : `“${item.title ?? 'Ish namunasi'}” rad etildi: ${dto.reason?.trim()}`,
        template: 'portfolio.reviewed',
        data: { portfolioId: itemId, status: updated.status },
      })
      .catch((error: unknown) => this.logger.warn(`Portfolio bildirishnomasini yuborib bo‘lmadi: ${String(error)}`));

    return updated;
  }
}
