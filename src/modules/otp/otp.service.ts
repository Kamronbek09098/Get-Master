import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose, OtpStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TooManyRequestsException } from '../../common/exceptions/business.exception';
import { MailService } from '../mail/mail.service';
import { ERRORS } from '../../common/constants/error-messages';

const OTP_PURPOSE_LABEL: Record<OtpPurpose, string> = {
  REGISTER: 'Ro‘yxatdan o‘tish',
  LOGIN: 'Tizimga kirish',
  PHONE_VERIFICATION: 'Telefonni tasdiqlash',
  PASSWORD_RESET: 'Parolni tiklash',
  CHANGE_PHONE: 'Telefonni almashtirish',
};

import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { TelegramAlertService } from '../../infrastructure/telegram/telegram-alert.service';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
    private readonly telegram: TelegramAlertService,
  ) {}

  private get ttlMs(): number {
    return this.config.getOrThrow<number>('limits.otp.ttlSeconds') * 1000;
  }
  private get resendMs(): number {
    return this.config.getOrThrow<number>('limits.otp.resendSeconds') * 1000;
  }
  private get windowMs(): number {
    return this.config.getOrThrow<number>('limits.otp.windowSeconds') * 1000;
  }
  private get maxRequests(): number {
    return this.config.getOrThrow<number>('limits.otp.maxRequestsPerWindow');
  }
  private get ipMultiplier(): number {
    return this.config.getOrThrow<number>('limits.otp.ipMultiplier');
  }
  private get maxAttempts(): number {
    return this.config.getOrThrow<number>('limits.otp.maxAttempts');
  }

  async issue(
    phoneInput: string,
    purpose: OtpPurpose,
    userId?: string,
    context?: { ip?: string; device?: string; panel?: string | null },
  ) {
    const phone = this.normalizePhone(phoneInput);
    const panel = context?.panel ?? null;
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.windowMs);
    const resendStart = new Date(now.getTime() - this.resendMs);

    const [recentPhone, lastPhone] = await Promise.all([
      this.db.otpCode.count({
        where: {
          phone,
          purpose,
          panel,
          createdAt: { gte: windowStart },
        },
      }),
      this.db.otpCode.findFirst({
        where: {
          phone,
          purpose,
          panel,
          createdAt: { gte: resendStart },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    if (recentPhone >= this.maxRequests) {
      this.metrics.otpAbused('phone_limit');
      const oldest = await this.db.otpCode.findFirst({
        where: { phone, purpose, panel, createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });
      const waitMs = oldest ? oldest.createdAt.getTime() + this.windowMs - now.getTime() : 0;
      throw new TooManyRequestsException(
        waitMs > 0 ? ERRORS.OTP_LIMIT_WAIT(Math.max(1, Math.ceil(waitMs / 60_000))) : ERRORS.OTP_LIMIT_EXCEEDED,
      );
    }

    if (lastPhone) {
      const remaining = Math.ceil(
        (this.resendMs - (now.getTime() - lastPhone.createdAt.getTime())) /
          1000,
      );
      if (remaining > 0) {
        this.metrics.otpAbused('resend_too_soon');
        throw new TooManyRequestsException(
          ERRORS.OTP_WAIT(remaining),
        );
      }
    }

    if (context?.ip) {
      const recentIp = await this.db.otpCode.count({
        where: {
          ipAddress: context.ip.slice(0, 64),
          purpose,
          panel,
          createdAt: { gte: windowStart },
        },
      });
      if (recentIp >= this.maxRequests * this.ipMultiplier) {
        this.metrics.otpAbused('ip_limit');
        throw new TooManyRequestsException(ERRORS.OTP_LIMIT_EXCEEDED);
      }
    }

    await this.db.otpCode.updateMany({
      where: {
        phone,
        purpose,
        status: OtpStatus.ACTIVE,
      },
      data: { status: OtpStatus.EXPIRED },
    });

    const code = randomInt(100000, 1_000_000).toString();
    const codeHash = await bcrypt.hash(code, 12);

    await this.db.otpCode.create({
      data: {
        phone,
        userId,
        codeHash,
        purpose,
        status: OtpStatus.ACTIVE,
        attempts: 0,
        maxAttempts: this.maxAttempts,
        expiresAt: new Date(now.getTime() + this.ttlMs),
        ipAddress: context?.ip?.slice(0, 64),
        panel,
      },
    });

    await this.deliver(phone, code, purpose);

    const metadata = {
      verificationRequired: true,
      expiresIn: this.ttlMs / 1000,
      resendAfter: this.resendMs / 1000,
    };
    if (this.config.get<string>('app.environment') !== 'production' && process.env.OTP_DEV_ECHO === 'true') {
      return { ...metadata, developmentCode: code };
    }
    return metadata;
  }

  private async deliver(phone: string, code: string, purpose: OtpPurpose): Promise<void> {
    let delivered = false;
    if (await this.telegram.sendOtp({ phone, code, purposeLabel: OTP_PURPOSE_LABEL[purpose], ttlMinutes: this.ttlMs / 60_000 })) {
      delivered = true;
    }
    try {
      const user = await this.db.user.findUnique({ where: { phone }, select: { email: true } });
      if (user?.email && this.mail.isEnabled()) {
        await this.mail.sendVerificationCode(user.email, code, purpose, this.ttlMs / 60_000);
        delivered = true;
      }
    } catch (error) {
      this.logger.error(`${purpose} uchun OTP emailga yuborib bo‘lmadi: ${(error as Error).message}`);
    }
    if (!delivered) {
      this.logger.warn(`${purpose} kodini yuborish uchun kanal yo‘q (Telegram, email/SMTP sozlanmagan; SMS transport yo‘q)`);
    }
  }

  async verify(phoneInput: string, purpose: OtpPurpose, code: string) {
    const phone = this.normalizePhone(phoneInput);
    const record = await this.db.otpCode.findFirst({
      where: {
        phone,
        purpose,
        status: OtpStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException(ERRORS.INVALID_VERIFICATION_CODE);
    }

    if (record.expiresAt <= new Date()) {
      await this.db.otpCode.updateMany({
        where: { id: record.id, status: OtpStatus.ACTIVE },
        data: { status: OtpStatus.EXPIRED },
      });
      throw new BadRequestException(ERRORS.INVALID_VERIFICATION_CODE);
    }

    if (record.attempts >= record.maxAttempts) {
      await this.db.otpCode.updateMany({
        where: { id: record.id, status: OtpStatus.ACTIVE },
        data: { status: OtpStatus.BLOCKED },
      });
      {
        this.metrics.otpAbused('attempts_exceeded');
        throw new TooManyRequestsException(ERRORS.VERIFICATION_ATTEMPTS_EXCEEDED);
      }
    }

    const valid = await bcrypt.compare(code, record.codeHash);

    if (!valid) {
      const update = await this.db.otpCode.updateMany({
        where: {
          id: record.id,
          status: OtpStatus.ACTIVE,
          attempts: { lt: record.maxAttempts },
        },
        data: { attempts: { increment: 1 } },
      });

      if (update.count === 0) {
        {
        this.metrics.otpAbused('attempts_exceeded');
        throw new TooManyRequestsException(ERRORS.VERIFICATION_ATTEMPTS_EXCEEDED);
      }
      }

      if (record.attempts + 1 >= record.maxAttempts) {
        await this.db.otpCode.updateMany({
          where: { id: record.id, status: OtpStatus.ACTIVE },
          data: { status: OtpStatus.BLOCKED },
        });
        {
        this.metrics.otpAbused('attempts_exceeded');
        throw new TooManyRequestsException(ERRORS.VERIFICATION_ATTEMPTS_EXCEEDED);
      }
      }

      throw new BadRequestException(ERRORS.INVALID_VERIFICATION_CODE);
    }

    const verified = await this.db.otpCode.updateMany({
      where: {
        id: record.id,
        status: OtpStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      data: {
        status: OtpStatus.VERIFIED,
        verifiedAt: new Date(),
      },
    });

    if (verified.count !== 1) {
      throw new BadRequestException(ERRORS.INVALID_VERIFICATION_CODE);
    }

    return true;
  }

  private normalizePhone(value: string) {
    const digits = value.replace(/\D/g, '');
    if (!/^998\d{9}$/.test(digits)) {
      throw new BadRequestException(ERRORS.INVALID_PHONE);
    }
    return `+${digits}`;
  }
}
