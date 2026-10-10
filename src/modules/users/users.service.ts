import { MasterStatus, OfferStatus, OrderStatus, OtpPurpose, RequestStatus, Role, SessionStatus, UserStatus } from '@prisma/client';
import { OtpService } from '../otp/otp.service';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { hashSecret, verifySecret } from '../../common/security/hash';
import { SetTwoFactorDto } from './dto/two-factor.dto';
import { SetEmailDto } from './dto/set-email.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UpdateNameDto } from './dto/update-name.dto';
import { ERRORS } from '../../common/constants/error-messages';

@Injectable()
export class UsersService {
  constructor(
    private readonly db: PrismaService,
    private readonly otp: OtpService,
  ) {}

  /** Mijoz profili sahifasi uchun aniq hisob-kitoblar: umumiy sonlar va tanlangan davr (oldingi davr bilan solishtirib). */
  async overview(userId: string, daysInput: number) {
    const days = [7, 30, 90].includes(daysInput) ? daysInput : 30;
    const now = Date.now();
    const from = new Date(now - days * 86_400_000);
    const prevFrom = new Date(now - 2 * days * 86_400_000);
    const requestWhere = { customerId: userId, status: { not: 'DRAFT' as const } };
    const orderWhere = { customerId: userId };
    const refundWhere = { customerId: userId, status: { in: ['REFUNDED' as const, 'PARTIALLY_REFUNDED' as const] } };
    const range = (gte: Date, lt?: Date) => ({ gte, ...(lt ? { lt } : {}) });
    const [requests, orders, masters, address, rCur, rPrev, oCur, oPrev, cCur, cPrev, fCur, fPrev] = await Promise.all([
      this.db.problemRequest.count({ where: requestWhere }),
      this.db.order.count({ where: orderWhere }),
      this.db.order.findMany({ where: orderWhere, distinct: ['masterId'], select: { masterId: true } }),
      this.db.address.findFirst({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }], select: { city: true, district: true, addressLine: true } }),
      this.db.problemRequest.count({ where: { ...requestWhere, createdAt: range(from) } }),
      this.db.problemRequest.count({ where: { ...requestWhere, createdAt: range(prevFrom, from) } }),
      this.db.order.count({ where: { ...orderWhere, createdAt: range(from) } }),
      this.db.order.count({ where: { ...orderWhere, createdAt: range(prevFrom, from) } }),
      this.db.order.count({ where: { ...orderWhere, status: 'CANCELLED', createdAt: range(from) } }),
      this.db.order.count({ where: { ...orderWhere, status: 'CANCELLED', createdAt: range(prevFrom, from) } }),
      this.db.payment.count({ where: { ...refundWhere, createdAt: range(from) } }),
      this.db.payment.count({ where: { ...refundWhere, createdAt: range(prevFrom, from) } }),
    ]);
    return {
      totals: { requests, orders, masters: masters.length },
      address,
      period: {
        days,
        requests: { value: rCur, previous: rPrev },
        orders: { value: oCur, previous: oPrev },
        cancelled: { value: cCur, previous: cPrev },
        refunded: { value: fCur, previous: fPrev },
      },
    };
  }

  async findMe(userId: string) {
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
        avatarAssetId: true,
        adminAvatarAllowed: true,
        status: true,
        phoneVerifiedAt: true,
        twoFactorEnabled: true,
        googleId: true,
        googleEmail: true,
        passwordHash: true,
        isSuperAdmin: true,
        adminPermissions: true,
        canCreateAdmins: true,
        grantablePermissions: true,
        createdAt: true,
        userRoles: { select: { role: true } },
        masterProfile: { select: { id: true, status: true, verification: true } },
      },
    });
    if (!user) {
      throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    }

    const roles = user.userRoles.map((item) => item.role);
    return {
      ...user,
      googleId: undefined,
      passwordHash: undefined,
      hasPassword: user.passwordHash !== null,
      googleLinked: user.googleId !== null,
      roles,
      userRoles: undefined,
      canSetAvatar: !roles.includes(Role.ADMIN) || user.isSuperAdmin || user.adminAvatarAllowed,
    };
  }

  /** Telefon raqamini (Google orqali ochilgan va telefonsiz akkaunt uchun) tasdiqlash kodini yuborish. */
  async requestPhoneCode(userId: string, phoneInput: string, context: { ip?: string; panel?: string | null }) {
    const phone = this.otp.normalizePhone(phoneInput);
    const taken = await this.db.user.findUnique({ where: { phone }, select: { id: true } });
    if (taken && taken.id !== userId) throw new ConflictException(ERRORS.PHONE_ALREADY_REGISTERED);
    return this.otp.issue(phone, OtpPurpose.CHANGE_PHONE, userId, context);
  }

  /** Kod to‘g‘ri bo‘lsa raqam akkauntga yoziladi va tasdiqlangan hisoblanadi. */
  async verifyPhone(userId: string, phoneInput: string, code: string) {
    const phone = this.otp.normalizePhone(phoneInput);
    await this.otp.verify(phone, OtpPurpose.CHANGE_PHONE, code);
    try {
      await this.db.user.update({ where: { id: userId }, data: { phone, phoneVerifiedAt: new Date() } });
    } catch {
      throw new ConflictException(ERRORS.PHONE_ALREADY_REGISTERED);
    }
    await this.db.auditLog.create({ data: { actorId: userId, action: 'USER_PHONE_VERIFIED', targetType: 'User', targetId: userId } });
    return this.findMe(userId);
  }

  /** Joriy parolni bilgan foydalanuvchi uni almashtiradi; boshqa qurilmalar tizimdan chiqariladi (joriy qurilma qoladi). */
  async changePassword(userId: string, currentDeviceId: string | undefined, currentPassword: string, newPassword: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true } });
    if (!user) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    if (!user.passwordHash) throw new ConflictException(ERRORS.PASSWORD_NOT_SET);
    if (!(await verifySecret(currentPassword, user.passwordHash))) throw new UnauthorizedException(ERRORS.CURRENT_PASSWORD_INVALID);
    if (await verifySecret(newPassword, user.passwordHash)) throw new BadRequestException(ERRORS.PASSWORD_SAME_AS_CURRENT);
    const passwordHash = await hashSecret(newPassword, 12);
    const revokedAt = new Date();
    const others = currentDeviceId ? { deviceId: { not: currentDeviceId } } : {};
    const revoked = await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.refreshToken.updateMany({ where: { userId, status: SessionStatus.ACTIVE, ...others }, data: { status: SessionStatus.REVOKED, revokedAt } });
      const sessions = await tx.deviceSession.updateMany({ where: { userId, status: SessionStatus.ACTIVE, ...others }, data: { status: SessionStatus.REVOKED, revokedAt } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'USER_PASSWORD_CHANGED', targetType: 'User', targetId: userId, after: { revokedSessions: sessions.count } } });
      return sessions.count;
    });
    return { changed: true, revokedSessions: revoked };
  }

  /** Faqat parol hali yo‘q akkauntga: birinchi parol o‘rnatiladi (mavjud parolni almashtirish boshqa yo‘l bilan). */
  async setInitialPassword(userId: string, password: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true } });
    if (!user) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    if (user.passwordHash) throw new ConflictException(ERRORS.PASSWORD_ALREADY_SET);
    const passwordHash = await hashSecret(password, 12);
    const result = await this.db.user.updateMany({ where: { id: userId, passwordHash: null }, data: { passwordHash } });
    if (result.count !== 1) throw new ConflictException(ERRORS.PASSWORD_ALREADY_SET);
    await this.db.auditLog.create({ data: { actorId: userId, action: 'USER_PASSWORD_SET', targetType: 'User', targetId: userId } });
    return this.findMe(userId);
  }

  async updateName(userId: string, dto: UpdateNameDto) {
    await this.db.user.update({
      where: { id: userId },
      data: { firstName: dto.firstName.trim(), lastName: dto.lastName.trim() },
    });
    return this.findMe(userId);
  }

  /**
   * Ikki bosqichli autentifikatsiyani (kirishda OTP) yoqish/o‘chirish.
   * O‘chirish uchun joriy parol talab qilinadi; administrator akkauntida har doim yoqilgan turadi.
   */
  async setTwoFactor(userId: string, dto: SetTwoFactorDto) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, twoFactorEnabled: true, userRoles: { select: { role: true } } },
    });
    if (!user) throw new NotFoundException(ERRORS.USER_NOT_FOUND);

    if (!dto.enabled) {
      if (!dto.password) throw new BadRequestException(ERRORS.TWO_FACTOR_PASSWORD_REQUIRED);
      const valid = !!user.passwordHash && (await verifySecret(dto.password, user.passwordHash));
      if (!valid) throw new UnauthorizedException(ERRORS.CURRENT_PASSWORD_INVALID);
    }

    if (user.twoFactorEnabled !== dto.enabled) {
      await this.db.$transaction([
        this.db.user.update({ where: { id: userId }, data: { twoFactorEnabled: dto.enabled } }),
        this.db.auditLog.create({
          data: {
            actorId: userId,
            action: dto.enabled ? 'USER_TWO_FACTOR_ENABLED' : 'USER_TWO_FACTOR_DISABLED',
            targetType: 'User',
            targetId: userId,
            before: { twoFactorEnabled: user.twoFactorEnabled },
            after: { twoFactorEnabled: dto.enabled },
          },
        }),
      ]);
    }
    return this.findMe(userId);
  }

  /** Tasdiqlash kodlari yuboriladigan email manzilni kiritish/almashtirish (parolli akkauntda joriy parol talab qilinadi). */
  async setEmail(userId: string, dto: SetEmailDto) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, passwordHash: true } });
    if (!user) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    if (user.passwordHash) {
      if (!dto.password) throw new BadRequestException(ERRORS.TWO_FACTOR_PASSWORD_REQUIRED);
      if (!(await verifySecret(dto.password, user.passwordHash))) throw new UnauthorizedException(ERRORS.CURRENT_PASSWORD_INVALID);
    }
    const email = dto.email.trim().toLowerCase();
    if (email !== user.email) {
      const taken = await this.db.user.findFirst({ where: { email, id: { not: userId }, deletedAt: null }, select: { id: true } });
      if (taken) throw new ConflictException(ERRORS.EMAIL_ALREADY_REGISTERED);
      await this.db.$transaction([
        this.db.user.update({ where: { id: userId }, data: { email } }),
        this.db.auditLog.create({
          data: { actorId: userId, action: 'USER_EMAIL_CHANGED', targetType: 'User', targetId: userId, before: { email: user.email }, after: { email } },
        }),
      ]);
    }
    return this.findMe(userId);
  }

  /**
   * Foydalanuvchi o‘z akkauntini o‘chiradi (yumshoq o‘chirish): telefon/email bo‘shatiladi, sessiyalar yopiladi, ochiq so‘rovlar bekor qilinadi.
   * Faol buyurtma bo‘lsa — o‘chirib bo‘lmaydi. Administrator akkaunti bu yo‘l bilan o‘chirilmaydi.
   */
  async deleteAccount(userId: string, dto: DeleteAccountDto, ip?: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        accountNumber: true,
        phone: true,
        email: true,
        passwordHash: true,
        status: true,
        deletedAt: true,
        userRoles: { select: { role: true } },
        masterProfile: { select: { id: true } },
      },
    });
    if (!user || user.deletedAt || user.status === UserStatus.DELETED) throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    if (user.userRoles.some((item) => item.role === Role.ADMIN)) throw new ForbiddenException(ERRORS.ACCOUNT_DELETE_ADMIN_FORBIDDEN);
    if (user.passwordHash) {
      if (!dto.password) throw new BadRequestException(ERRORS.TWO_FACTOR_PASSWORD_REQUIRED);
      if (!(await verifySecret(dto.password, user.passwordHash))) throw new UnauthorizedException(ERRORS.CURRENT_PASSWORD_INVALID);
    }

    const inProgress: OrderStatus[] = [
      OrderStatus.BOOKED,
      OrderStatus.CONFIRMED,
      OrderStatus.ON_THE_WAY,
      OrderStatus.ARRIVED,
      OrderStatus.IN_PROGRESS,
      OrderStatus.WAITING_CONFIRMATION,
      OrderStatus.DISPUTED,
    ];
    const active = await this.db.order.count({
      where: { status: { in: inProgress }, OR: [{ customerId: userId }, ...(user.masterProfile ? [{ masterId: user.masterProfile.id }] : [])] },
    });
    if (active > 0) throw new ConflictException(ERRORS.ACCOUNT_DELETE_ACTIVE_ORDERS);

    const originalPhone = user.phone;
    await this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.DELETED,
          deletedAt: new Date(),
          phone: originalPhone ? `del${user.accountNumber}_${originalPhone}`.slice(0, 32) : null,
          email: null,
          passwordHash: null,
          googleId: null,
        },
      });
      if (user.masterProfile) {
        await tx.masterProfile.update({ where: { id: user.masterProfile.id }, data: { status: MasterStatus.SUSPENDED } });
        await tx.offer.updateMany({ where: { masterId: user.masterProfile.id, status: OfferStatus.PENDING }, data: { status: OfferStatus.WITHDRAWN } });
      }
      await tx.problemRequest.updateMany({
        where: { customerId: userId, status: { in: [RequestStatus.DRAFT, RequestStatus.SUBMITTED, RequestStatus.MATCHING, RequestStatus.OFFERS_RECEIVED] } },
        data: { status: RequestStatus.CANCELLED },
      });
      await tx.otpCode.deleteMany({ where: { OR: [{ userId }, ...(originalPhone ? [{ phone: originalPhone }] : [])] } });
      const revokedAt = new Date();
      await tx.refreshToken.updateMany({ where: { userId, status: SessionStatus.ACTIVE }, data: { status: SessionStatus.REVOKED, revokedAt } });
      await tx.deviceSession.updateMany({ where: { userId, status: SessionStatus.ACTIVE }, data: { status: SessionStatus.REVOKED, revokedAt } });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'USER_SELF_DELETED',
          targetType: 'User',
          targetId: userId,
          before: { status: user.status, phone: originalPhone, email: user.email, roles: user.userRoles.map((item) => item.role) },
          after: { status: UserStatus.DELETED },
          ipAddress: ip?.slice(0, 64) ?? null,
        },
      });
    });
    return { deleted: true };
  }
}
