import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MasterStatus, Prisma, Role, SessionStatus, UserStatus } from '@prisma/client';
import type { Request } from 'express';
import { ERRORS } from '../../common/constants/error-messages';
import { cursorArgs, toCursorPage } from '../../common/utils/cursor';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import * as bcrypt from 'bcryptjs';
import { openPassword, passwordVaultEnabled, sealPassword } from '../../common/security/password-vault';
import { DeleteUserDto, SetUserPasswordDto, SetUserStatusDto } from './dto/user-action.dto';
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
    // ID (accountNumber) bo‘yicha qidirilganda admin akkauntlar ham qidiruv doirasiga kiradi —
    // oddiy ism/telefon qidiruvi va filtrsiz ro‘yxat avvalgidek faqat mijoz/ustalar bilan cheklanadi.
    const isIdSearch = !!query.search && /^\d{1,9}$/.test(query.search);
    const roles = query.role ? [query.role] : isIdSearch ? [Role.CUSTOMER, Role.MASTER, Role.ADMIN] : [Role.CUSTOMER, Role.MASTER];
    const where: Prisma.UserWhereInput = {
      userRoles: { some: { role: { in: roles } } },
      status: query.status,
      deletedAt: query.status === UserStatus.DELETED ? { not: null } : null,
    };
    if (query.search) {
      // accountNumber — Int ustun, Prisma uni matn sifatida qisman (contains) solishtira olmaydi,
      // shuning uchun mos keladigan raqamlarni kichik raw so‘rov bilan topib, natijani OR ga qo‘shamiz.
      const matchingAccountNumbers = isIdSearch
        ? await this.db.$queryRaw<Array<{ accountNumber: number }>>`
            SELECT "account_number" AS "accountNumber" FROM users WHERE "account_number"::text LIKE ${`%${query.search}%`} LIMIT 50
          `
        : [];
      where.OR = [
        { phone: { contains: query.search } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        ...(matchingAccountNumbers.length ? [{ accountNumber: { in: matchingAccountNumbers.map((row) => row.accountNumber) } }] : []),
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
    const base = await this.findOne(user.id);
    // Admin profil sahifasi uchun qo‘shimcha ma’lumotlar: manzillar, oxirgi buyurtmalar, usta ko‘rsatkichlari va xizmatlari.
    const [addresses, orders, master] = await Promise.all([
      this.db.address.findMany({
        where: { userId: user.id },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        take: 5,
        select: { id: true, title: true, addressLine: true, city: true, district: true, isDefault: true },
      }),
      this.db.order.findMany({
        where: { OR: [{ customerId: user.id }, { master: { userId: user.id } }] },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, orderNumber: true, status: true, finalAmount: true, currency: true, createdAt: true, customerId: true },
      }),
      base.masterProfile
        ? this.db.masterProfile.findUnique({
            where: { id: base.masterProfile.id },
            select: {
              ratingCount: true,
              completionRate: true,
              responseRate: true,
              workRadiusKm: true,
              serviceAreas: true,
              isPaused: true,
              services: { where: { isActive: true }, take: 12, select: { basePrice: true, service: { select: { name: true } } } },
            },
          })
        : null,
    ]);
    return {
      ...base,
      addresses,
      recentOrders: orders.map(({ customerId, ...order }) => ({ ...order, side: customerId === user.id ? 'CUSTOMER' : 'MASTER' })),
      masterExtra: master
        ? { ...master, services: master.services.map((item) => ({ name: item.service.name, basePrice: item.basePrice })) }
        : null,
    };
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

  /**
   * Admin foydalanuvchiga yangi parol belgilaydi. Eski parol shifrlangan (bcrypt) saqlanadi va uni ko‘rsatib bo‘lmaydi;
   * yangi parol faqat shu so‘rovda beriladi, bazada/auditda ochiq ko‘rinishda saqlanmaydi. Barcha qurilmalardan chiqariladi.
   */
  async setPassword(adminId: string, userId: string, dto: SetUserPasswordDto, req: Request) {
    const target = await this.loadModerable(adminId, userId);
    if (target.status === UserStatus.DELETED || target.deletedAt) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash, passwordEnc: sealPassword(dto.password) } });
      await this.revokeAllSessions(tx, userId);
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'ADMIN_USER_PASSWORD_RESET',
          targetType: 'User',
          targetId: userId,
          reason: dto.reason?.trim() || null,
          ipAddress: req.ip?.slice(0, 64) ?? null,
          requestId: (req as { id?: string }).id ?? null,
        },
      });
    });
    return { updated: true };
  }

  /** Faqat administrator: oddiy foydalanuvchining saqlangan (shifrdan ochilgan) parolini ko‘rsatadi; har bir ko‘rish auditga yoziladi. */
  async revealPassword(adminId: string, userId: string, req: Request) {
    const target = await this.loadModerable(adminId, userId);
    const record = await this.db.user.findUnique({ where: { id: userId }, select: { passwordEnc: true } });
    const password = openPassword(record?.passwordEnc);
    await this.db.auditLog.create({
      data: {
        actorId: adminId,
        action: 'ADMIN_USER_PASSWORD_VIEWED',
        targetType: 'User',
        targetId: target.id,
        ipAddress: req.ip?.slice(0, 64) ?? null,
        requestId: (req as { id?: string }).id ?? null,
      },
    });
    return { password, available: password !== null, vaultEnabled: passwordVaultEnabled() };
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
