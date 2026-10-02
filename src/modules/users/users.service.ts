import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { verifySecret } from '../../common/security/hash';
import { SetTwoFactorDto } from './dto/two-factor.dto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UpdateNameDto } from './dto/update-name.dto';
import { ERRORS } from '../../common/constants/error-messages';

@Injectable()
export class UsersService {
  constructor(private readonly db: PrismaService) {}

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
      roles: user.userRoles.map((item) => item.role),
      userRoles: undefined,
    };
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
      if (user.userRoles.some((item) => item.role === Role.ADMIN)) throw new ForbiddenException(ERRORS.TWO_FACTOR_ADMIN_REQUIRED);
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
