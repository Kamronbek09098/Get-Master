import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MasterStatus, Prisma, Role, SessionStatus, UserStatus } from '@prisma/client';
import type { Request } from 'express';
import { ERRORS } from '../../common/constants/error-messages';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { DeleteUserDto, SetUserStatusDto } from './dto/user-action.dto';
import { UserQueryDto } from './dto/user-query.dto';

const USER_SELECT = {
  id: true,
        accountNumber: true,
  phone: true,
  email: true,
  firstName: true,
  lastName: true,
  status: true,
  createdAt: true,
  deletedAt: true,
  userRoles: { select: { role: true } },
  masterProfile: {
    select: { id: true, profession: true, status: true, verification: true, ratingAvg: true, completedOrders: true },
  },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

function present({ userRoles, ...user }: UserRow) {
  return { ...user, roles: userRoles.map((item) => item.role) };
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly db: PrismaService) {}

  async findAll(query: UserQueryDto) {
    const roles = query.role ? [query.role] : [Role.CUSTOMER, Role.MASTER];
    const where: Prisma.UserWhereInput = {
      userRoles: { some: { role: { in: roles } } },
      status: query.status,
      deletedAt: query.status === UserStatus.DELETED ? { not: null } : null,
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
      select: USER_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    return { items: page.items.map(present), nextCursor: page.nextCursor };
  }

  /** Raqamli ID (akkaunt raqami) bo‘yicha foydalanuvchini topadi. */
  async lookupByNumber(accountNumber: number) {
    const user = await this.db.user.findUnique({ where: { accountNumber }, select: { id: true } });
    if (!user) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    return this.findOne(user.id);
  }

  /** Bitta akkaunt haqida to‘liq ma’lumot (admin ham, mijoz/usta ham). */
  async findOne(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        accountNumber: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
        deletedAt: true,
        lastLoginAt: true,
        phoneVerifiedAt: true,
        userRoles: { select: { role: true } },
        masterProfile: {
          select: { id: true, profession: true, bio: true, experienceYears: true, status: true, verification: true, ratingAvg: true, completedOrders: true },
        },
        _count: { select: { ordersAsCustomer: true, requests: true, sentMessages: true, reviews: true } },
      },
    });
    if (!user) throw new NotFoundException(ERRORS.USER_NOT_FOUND);

    const [activeDevices, lastSession, recent] = await Promise.all([
      this.db.deviceSession.count({ where: { userId, status: SessionStatus.ACTIVE } }),
      this.db.deviceSession.findFirst({ where: { userId }, orderBy: { lastSeenAt: 'desc' }, select: { lastSeenAt: true, ipAddress: true, userAgent: true, panel: true } }),
      this.db.auditLog.findMany({
        where: { OR: [{ actorId: userId }, { targetId: userId }], action: { not: 'AUTH_REFRESH_ROTATED' } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, action: true, reason: true, actorId: true, createdAt: true, actor: { select: { accountNumber: true } } },
      }),
    ]);
    const { userRoles, _count, ...rest } = user;
    return {
      ...rest,
      roles: userRoles.map((item) => item.role),
      stats: { orders: _count.ordersAsCustomer, requests: _count.requests, messages: _count.sentMessages, reviews: _count.reviews, activeDevices },
      lastSession,
      recentActivity: recent,
    };
  }

  async setStatus(adminId: string, userId: string, dto: SetUserStatusDto, req: Request) {
    const target = await this.loadModerable(adminId, userId);

    if (dto.status === 'ACTIVE') {
      if (target.status !== UserStatus.SUSPENDED && target.status !== UserStatus.BLOCKED) {
        throw new ConflictException(ERRORS.USER_STATUS_TRANSITION_INVALID(target.status, dto.status));
      }
    } else {
      if (!dto.reason || dto.reason.trim().length < 3) throw new BadRequestException(ERRORS.USER_ACTION_REASON_REQUIRED);
      if (target.status === UserStatus.DELETED) {
        throw new ConflictException(ERRORS.USER_STATUS_TRANSITION_INVALID(target.status, dto.status));
      }
    }
    if (target.status === dto.status) return present(target);

    const restricting = dto.status !== 'ACTIVE';
    const updated = await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { status: dto.status } });
      if (target.masterProfile) {
        await tx.masterProfile.update({
          where: { id: target.masterProfile.id },
          data: { status: restricting ? MasterStatus.SUSPENDED : MasterStatus.INACTIVE },
        });
      }
      if (restricting) await this.revokeAllSessions(tx, userId);
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: restricting ? `ADMIN_USER_${dto.status}` : 'ADMIN_USER_REACTIVATED',
          targetType: 'User',
          targetId: userId,
          before: { status: target.status },
          after: { status: dto.status },
          reason: dto.reason?.trim() || null,
          ipAddress: req.ip?.slice(0, 64) ?? null,
          requestId: (req as { id?: string }).id ?? null,
        },
      });
      return tx.user.findUniqueOrThrow({ where: { id: userId }, select: USER_SELECT });
    });
    return present(updated);
  }

  async remove(adminId: string, userId: string, dto: DeleteUserDto, req: Request) {
    const target = await this.loadModerable(adminId, userId);
    if (target.status === UserStatus.DELETED || target.deletedAt) throw new NotFoundException(ERRORS.USER_NOT_FOUND);

    await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { status: UserStatus.DELETED, deletedAt: new Date() } });
      if (target.masterProfile) {
        await tx.masterProfile.update({ where: { id: target.masterProfile.id }, data: { status: MasterStatus.SUSPENDED } });
      }
      await this.revokeAllSessions(tx, userId);
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'ADMIN_USER_DELETED',
          targetType: 'User',
          targetId: userId,
          before: { status: target.status },
          after: { status: UserStatus.DELETED },
          reason: dto.reason.trim(),
          ipAddress: req.ip?.slice(0, 64) ?? null,
          requestId: (req as { id?: string }).id ?? null,
        },
      });
    });
    return { deleted: true };
  }

  private async loadModerable(adminId: string, userId: string) {
    const target = await this.db.user.findUnique({ where: { id: userId }, select: USER_SELECT });
    if (!target) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    if (target.id === adminId || target.userRoles.some((item) => item.role === Role.ADMIN)) {
      throw new ForbiddenException(ERRORS.CANNOT_MODERATE_ADMIN);
    }
    return target;
  }

  private async revokeAllSessions(tx: Prisma.TransactionClient, userId: string) {
    const revokedAt = new Date();
    await tx.refreshToken.updateMany({
      where: { userId, status: SessionStatus.ACTIVE },
      data: { status: SessionStatus.REVOKED, revokedAt },
    });
    await tx.deviceSession.updateMany({
      where: { userId, status: SessionStatus.ACTIVE },
      data: { status: SessionStatus.REVOKED, revokedAt },
    });
  }
}
