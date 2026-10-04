import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { OrderService } from '../order/order.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { ERRORS } from '../../common/constants/error-messages';

const RATING_WINDOW = 200;

const PUBLIC_REVIEW_SELECT = {
  id: true,
  rating: true,
  comment: true,
  createdAt: true,
  author: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.ReviewSelect;

@Injectable()
export class ReviewService {
  constructor(
    private readonly db: PrismaService,
    private readonly orderService: OrderService,
  ) {}

  async create(userId: string, dto: CreateReviewDto) {
    const participants = await this.orderService.getOrderParticipants(dto.orderId);
    if (participants.customerId !== userId) throw new ForbiddenException(ERRORS.ONLY_CUSTOMER_CAN_REVIEW);
    if (participants.status !== OrderStatus.COMPLETED) throw new BadRequestException(ERRORS.ONLY_COMPLETED_CAN_REVIEW);

    const status: ReviewStatus = dto.rating <= 1 && !dto.comment?.trim() ? ReviewStatus.FLAGGED : ReviewStatus.PUBLISHED;

    try {
      return await this.db.$transaction(async (tx) => {
        const review = await tx.review.create({
          data: {
            orderId: dto.orderId,
            authorId: userId,
            masterProfileId: participants.masterId,
            rating: dto.rating,
            comment: dto.comment,
            status,
            flaggedReason: status === ReviewStatus.FLAGGED ? '1-star (or lower) review without a comment' : undefined,
          },
          select: { ...PUBLIC_REVIEW_SELECT, status: true, orderId: true },
        });

        const published = await tx.review.findMany({
          where: { masterProfileId: participants.masterId, status: ReviewStatus.PUBLISHED },
          orderBy: { createdAt: 'desc' },
          take: RATING_WINDOW,
          select: { rating: true },
        });
        const total = await tx.review.count({ where: { masterProfileId: participants.masterId, status: ReviewStatus.PUBLISHED } });
        const average = published.length ? published.reduce((sum, r) => sum + r.rating, 0) / published.length : 0;

        await tx.masterProfile.update({
          where: { id: participants.masterId },
          data: { ratingAvg: Math.round(average * 100) / 100, ratingCount: total },
        });
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'REVIEW_CREATED',
            targetType: 'Review',
            targetId: review.id,
            after: { orderId: dto.orderId, rating: dto.rating, status } as Prisma.InputJsonValue,
          },
        });
        return review;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(ERRORS.ORDER_ALREADY_REVIEWED);
      }
      throw error;
    }
  }

  async findAll(query: ReviewQueryDto) {
    const rows = await this.db.review.findMany({
      where: { masterProfileId: query.masterId, status: ReviewStatus.PUBLISHED },
      select: PUBLIC_REVIEW_SELECT,
      orderBy: { createdAt: 'desc' },
      ...cursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  async findOne(reviewId: string) {
    const review = await this.db.review.findFirst({
      where: { id: reviewId, status: ReviewStatus.PUBLISHED },
      select: { ...PUBLIC_REVIEW_SELECT, masterProfileId: true },
    });
    if (!review) throw new NotFoundException(ERRORS.REVIEW_NOT_FOUND);
    return review;
  }
}
