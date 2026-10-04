import { OtpPurpose } from '@prisma/client';
import { OtpService } from '../otp/otp.service';
import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { hashSecret, verifySecret } from '../../common/security/hash';
import { SetTwoFactorDto } from './dto/two-factor.dto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UpdateNameDto } from './dto/update-name.dto';
import { ERRORS } from '../../common/constants/error-messages';

@Injectable()
export class UsersService {
  constructor(
    private readonly db: PrismaService,
    private readonly otp: OtpService,
  ) {}

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
        status: true,
        phoneVerifiedAt: true,
        twoFactorEnabled: true,
        googleId: true,
        googleEmail: true,
        passwordHash: true,
        isSuperAdmin: true,
        adminPermissions: true,
        createdAt: true,
        userRoles: { select: { role: true } },
        masterProfile: { select: { id: true, status: true, verification: true } },
      },
    });
    if (!user) {
      throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    }

    return {
      ...user,
      googleId: undefined,
      passwordHash: undefined,
      hasPassword: user.passwordHash !== null,
      googleLinked: user.googleId !== null,
      roles: user.userRoles.map((item) => item.role),
      userRoles: undefined,
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
}
