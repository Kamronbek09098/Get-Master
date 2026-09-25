import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AppealStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { CreateCompensationDto } from './dto/create-compensation.dto';
import { CreateUserActionDto } from './dto/create-user-action.dto';
import { UpdateAppealDto } from './dto/update-appeal.dto';
import { UserActionQueryDto } from './dto/user-action-query.dto';

@Injectable()
export class TrustSafetyService {
  constructor(private readonly db: PrismaService) {}

  async createAction(adminId: string, dto: CreateUserActionDto) {
    const user = await this.db.user.findUnique({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    }

    const action = await this.db.userAction.create({
      data: {
        userId: dto.userId,
        caseId: dto.caseId,
        policyId: dto.policyId,
        type: dto.type,
        restrictionType: dto.restrictionType,
        reason: dto.reason,
        startsAt: new Date(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    await this.writeAudit(adminId, 'USER_ACTION_CREATED', 'UserAction', action.id);
    return action;
  }

  findAllActions(query: UserActionQueryDto) {
    return this.db.userAction.findMany({
      where: { userId: query.userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async liftAction(adminId: string, id: string) {
    const action = await this.db.userAction.findUnique({ where: { id } });
    if (!action) {
      throw new NotFoundException(ERRORS.USER_ACTION_NOT_FOUND);
    }

    const updated = await this.db.userAction.update({
      where: { id },
      data: { liftedAt: new Date() },
    });
    await this.writeAudit(adminId, 'USER_ACTION_LIFTED', 'UserAction', id);
    return updated;
  }

  async createAppeal(userId: string, dto: CreateAppealDto) {
    if (dto.actionId) {
      const action = await this.db.userAction.findUnique({ where: { id: dto.actionId } });
      if (!action) {
        throw new NotFoundException(ERRORS.USER_ACTION_NOT_FOUND);
      }
      if (action.userId !== userId) {
        throw new ForbiddenException(ERRORS.FORBIDDEN);
      }
    }

    if (dto.caseId) {
      const found = await this.db.case.findUnique({ where: { id: dto.caseId } });
      if (!found) {
        throw new NotFoundException(ERRORS.CASE_NOT_FOUND);
      }
      if (found.openedById !== userId && found.targetUserId !== userId) {
        throw new ForbiddenException(ERRORS.FORBIDDEN);
      }
    }

    return this.db.appeal.create({
      data: {
        userId,
        caseId: dto.caseId,
        actionId: dto.actionId,
        reason: dto.reason,
      },
    });
  }

  findMyAppeals(userId: string) {
    return this.db.appeal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAllAppeals() {
    return this.db.appeal.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async updateAppeal(adminId: string, id: string, dto: UpdateAppealDto) {
    const appeal = await this.db.appeal.findUnique({ where: { id } });
    if (!appeal) {
      throw new NotFoundException(ERRORS.APPEAL_NOT_FOUND);
    }

    const isClosed =
      dto.status === AppealStatus.ACCEPTED || dto.status === AppealStatus.REJECTED || dto.status === AppealStatus.CLOSED;

    const updated = await this.db.appeal.update({
      where: { id },
      data: {
        status: dto.status,
        decision: dto.decision,
        resolvedAt: isClosed ? new Date() : null,
      },
    });

    if (dto.status === AppealStatus.ACCEPTED && appeal.actionId) {
      await this.db.userAction.update({
        where: { id: appeal.actionId },
        data: { liftedAt: new Date() },
      });
    }

    await this.writeAudit(adminId, 'APPEAL_UPDATED', 'Appeal', id);
    return updated;
  }

  async createCompensation(adminId: string, dto: CreateCompensationDto) {
    const compensation = await this.db.compensation.create({
      data: {
        caseId: dto.caseId,
        recipientId: dto.recipientId,
        type: dto.type,
        amount: dto.amount,
        reason: dto.reason,
      },
    });
    await this.writeAudit(adminId, 'COMPENSATION_CREATED', 'Compensation', compensation.id);
    return compensation;
  }

  findMyCompensations(userId: string) {
    return this.db.compensation.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async writeAudit(adminId: string, action: string, targetType: string, targetId: string) {
    await this.db.auditLog.create({
      data: { actorId: adminId, action, targetType, targetId },
    });
  }
}
