import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OtpPurpose,
  PolicyStatus,
  PolicyType,
  Prisma,
  Role,
  SessionStatus,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { panelOf } from '../../common/utils/panel';
import { authCookieNames } from '../../common/utils/panel';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { LoginLockedException } from '../../common/exceptions/business.exception';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OtpService } from '../otp/otp.service';
import { SignInDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyOTPDto } from '../otp/dto/verify-otp.dto';
import {
  DEVICE_COOKIE_TTL_DAYS,
} from '../../common/constants/auth.constants';
import {
  AccessClaims,
  createJwt,
  newOpaqueToken,
  RefreshClaims,
  verifyJwt,
} from '../../common/types/auth.types';
import { ERRORS } from '../../common/constants/error-messages';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly otp: OtpService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async register(dto: RegisterDto, req: Request) {
    const phone = this.normalizePhone(dto.phone);
    const email = dto.email?.trim().toLowerCase() || null;
    const policyIds = [...new Set(dto.acceptedPolicyIds)];

    if (policyIds.length !== dto.acceptedPolicyIds.length) {
      throw new BadRequestException(ERRORS.DUPLICATE_POLICY_ACCEPTANCE);
    }

    const requiredPolicies = await this.getRequiredPolicies();
    const requiredIds = new Set(requiredPolicies.map((policy) => policy.id));
    if (
      requiredPolicies.length === 0 ||
      requiredPolicies.some((policy) => !policyIds.includes(policy.id))
    ) {
      throw new BadRequestException(ERRORS.POLICY_ACCEPTANCE_MISSING);
    }
    if (policyIds.some((id) => !requiredIds.has(id))) {
      throw new BadRequestException(ERRORS.INVALID_POLICY_ACCEPTANCE);
    }

    const existing = await this.db.user.findUnique({
      where: { phone },
      select: { id: true, deletedAt: true, status: true, passwordHash: true, accountNumber: true },
    });
    if (existing) {
      const owner =
        existing.deletedAt === null &&
        existing.status === UserStatus.ACTIVE &&
        !!existing.passwordHash &&
        (await bcrypt.compare(dto.password, existing.passwordHash));
      if (!owner) throw new ConflictException(ERRORS.PHONE_ALREADY_REGISTERED);
      if (panelOf(req) !== 'MASTER') {
        await this.db.userRole.createMany({ data: [{ userId: existing.id, role: Role.CUSTOMER }], skipDuplicates: true });
      }
      const signedIn = await this.signIn({ phone: dto.phone, password: dto.password }, req);
      return { ...signedIn, existingAccount: true, accountNumber: existing.accountNumber };
    }

    if (email) {
      const emailUser = await this.db.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (emailUser) {
        throw new ConflictException(ERRORS.EMAIL_ALREADY_REGISTERED);
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.withSerializableRetry(async (tx) => {
      const account = await tx.user.create({
        data: {
          phone,
          email,
          passwordHash,
          firstName: dto.firstName?.trim() || null,
          lastName: dto.lastName?.trim() || null,
          status: UserStatus.PENDING,
          userRoles: { create: { role: Role.CUSTOMER } },
        },
        select: { id: true, phone: true },
      });

      await tx.policyAcceptance.createMany({
        data: policyIds.map((policyId) => ({
          userId: account.id,
          policyId,
          ipAddress: this.clientIp(req),
        })),
      });

      await tx.auditLog.create({
        data: {
          actorId: account.id,
          action: 'AUTH_REGISTERED',
          targetType: 'User',
          targetId: account.id,
          after: { status: UserStatus.PENDING },
          ipAddress: this.clientIp(req),
          requestId: this.requestId(req),
        },
      });

      return account;
    });

    const issued = await this.otp.issue(phone, OtpPurpose.REGISTER, user.id, {
      ip: this.clientIp(req),
      device: this.deviceCookie(req),
      panel: panelOf(req),
    });

    return { userId: user.id, verificationRequired: true, ...this.devCode(issued) };
  }

  async confirmRegistration(dto: VerifyOTPDto, req?: Request) {
    const phone = this.normalizePhone(dto.phone);
    const user = await this.db.user.findUnique({
      where: { phone },
      select: {
        id: true,
        phone: true,
        status: true,
        deletedAt: true,
      },
    });

    if (
      !user ||
      user.deletedAt !== null ||
      user.status !== UserStatus.PENDING
    ) {
      throw new BadRequestException(ERRORS.INVALID_VERIFICATION_REQUEST);
    }

    await this.otp.verify(phone, OtpPurpose.REGISTER, dto.code);

    const updated = await this.db.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: {
          id: user.id,
          status: UserStatus.PENDING,
          deletedAt: null,
        },
        data: {
          status: UserStatus.ACTIVE,
          phoneVerifiedAt: new Date(),
        },
      });

      if (result.count !== 1) {
        throw new BadRequestException(ERRORS.INVALID_VERIFICATION_REQUEST);
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'AUTH_REGISTRATION_VERIFIED',
          targetType: 'User',
          targetId: user.id,
          after: { status: UserStatus.ACTIVE },
          ipAddress: req ? this.clientIp(req) : undefined,
          requestId: req ? this.requestId(req) : undefined,
        },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { id: true, phone: true, status: true },
      });
    });

    return updated;
  }

  async signIn(dto: SignInDto, req: Request) {
    const phone = this.normalizePhone(dto.phone);
    const attemptKey = `${this.clientIp(req) ?? 'unknown'}:${phone}:${panelOf(req) ?? 'any'}`;
    await this.assertLoginNotLocked(attemptKey);
    const user = await this.db.user.findUnique({
      where: { phone },
      select: {
        id: true,
        phone: true,
        passwordHash: true,
        status: true,
        deletedAt: true,
      },
    });

    const validPassword =
      !!user?.passwordHash &&
      (await bcrypt.compare(dto.password, user.passwordHash));

    if (!user || user.deletedAt !== null || !validPassword) {
      await this.registerLoginFailure(attemptKey);
      throw new UnauthorizedException(ERRORS.INVALID_CREDENTIALS);
    }
    await this.redis.del(`loginfail:${attemptKey}`);

    if (
      user.status === UserStatus.BLOCKED ||
      user.status === UserStatus.SUSPENDED ||
      user.status === UserStatus.DELETED
    ) {
      throw new ForbiddenException(ERRORS.ACCOUNT_NOT_AVAILABLE);
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(ERRORS.ACCOUNT_VERIFICATION_REQUIRED);
    }

    const issued = await this.otp.issue(phone, OtpPurpose.LOGIN, user.id, {
      ip: this.clientIp(req),
      device: this.deviceCookie(req),
      panel: panelOf(req),
    });

    return { verificationRequired: true, ...this.devCode(issued) };
  }

  private async assertLoginNotLocked(attemptKey: string): Promise<void> {
    const remaining = await this.redis.ttl(`loginlock:${attemptKey}`);
    if (remaining > 0) throw new LoginLockedException(remaining);
  }

  private async registerLoginFailure(attemptKey: string): Promise<void> {
    const { maxFailures, failureWindowSeconds, lockSeconds } = this.config.getOrThrow<{
      maxFailures: number;
      failureWindowSeconds: number;
      lockSeconds: number;
    }>('limits.login');
    const { remaining } = await this.redis.consume(`loginfail:${attemptKey}`, maxFailures, failureWindowSeconds);
    if (remaining > 0) return;
    await this.redis.set(`loginlock:${attemptKey}`, '1', lockSeconds);
    await this.redis.del(`loginfail:${attemptKey}`);
  }

  async confirmSignIn(dto: VerifyOTPDto, req: Request, res: Response) {
    const phone = this.normalizePhone(dto.phone);
    const user = await this.db.user.findUnique({
      where: { phone },
      include: { userRoles: { select: { role: true } } },
    });

    if (
      !user ||
      user.deletedAt !== null ||
      user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException(ERRORS.INVALID_VERIFICATION_REQUEST);
    }

    await this.otp.verify(phone, OtpPurpose.LOGIN, dto.code);

    return this.createSession(
      user.id,
      user.userRoles.map((item) => item.role),
      user.status,
      req,
      res,
    );
  }

  async refresh(refreshToken: string | undefined, req: Request, res: Response) {
    if (!refreshToken) {
      this.clearCookies(res, req);
      throw new UnauthorizedException(ERRORS.AUTHENTICATION_REQUIRED);
    }

    let claims: RefreshClaims;
    try {
      claims = verifyJwt<RefreshClaims>(
        refreshToken,
        this.jwtSecret(),
        'refresh',
      );
    } catch {
      this.clearCookies(res, req);
      throw new UnauthorizedException(ERRORS.AUTHENTICATION_REQUIRED);
    }

    const outcome = await this.withSerializableRetry(async (tx) => {
      const stored = await tx.refreshToken.findUnique({
        where: { id: claims.jti },
      });

      if (
        !stored ||
        stored.userId !== claims.sub ||
        stored.deviceId !== claims.deviceId ||
        stored.familyId !== claims.familyId
      ) {
        await this.revokeDevice(tx, claims.sub, claims.deviceId);
        return { failure: ERRORS.AUTHENTICATION_REQUIRED } as const;
      }

      if (stored.status !== SessionStatus.ACTIVE) {
        await this.revokeFamily(tx, stored.userId, stored.familyId, stored.deviceId);
        return { failure: ERRORS.REFRESH_TOKEN_REUSED } as const;
      }

      if (stored.expiresAt <= new Date()) {
        await this.revokeFamily(tx, stored.userId, stored.familyId, stored.deviceId);
        return { failure: ERRORS.AUTHENTICATION_REQUIRED } as const;
      }

      const valid = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (!valid) {
        await this.revokeFamily(tx, stored.userId, stored.familyId, stored.deviceId);
        return { failure: ERRORS.AUTHENTICATION_REQUIRED } as const;
      }

      const user = await tx.user.findUnique({
        where: { id: claims.sub },
        include: { userRoles: { select: { role: true } } },
      });

      if (
        !user ||
        user.deletedAt !== null ||
        user.status !== UserStatus.ACTIVE
      ) {
        await this.revokeDevice(tx, claims.sub, claims.deviceId);
        return { failure: ERRORS.AUTHENTICATION_REQUIRED } as const;
      }

      const rotated = await tx.refreshToken.updateMany({
        where: {
          id: stored.id,
          status: SessionStatus.ACTIVE,
        },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
          lastSeenAt: new Date(),
        },
      });

      if (rotated.count !== 1) {
        await this.revokeFamily(tx, stored.userId, stored.familyId, stored.deviceId);
        return { failure: ERRORS.REFRESH_TOKEN_REUSED } as const;
      }

      const newTokenId = randomUUID();
      const nextRefreshToken = this.issueRefresh(
        user.id,
        claims.deviceId,
        claims.familyId,
        newTokenId,
      );

      await tx.refreshToken.create({
        data: {
          id: newTokenId,
          userId: user.id,
          deviceId: claims.deviceId,
          familyId: claims.familyId,
          tokenHash: await bcrypt.hash(nextRefreshToken, 12),
          expiresAt: this.refreshExpiry(),
          status: SessionStatus.ACTIVE,
        },
      });

      await tx.deviceSession.updateMany({
        where: {
          userId: user.id,
          deviceId: claims.deviceId,
          status: SessionStatus.ACTIVE,
        },
        data: { lastSeenAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'AUTH_REFRESH_ROTATED',
          targetType: 'DeviceSession',
          ipAddress: this.clientIp(req),
          requestId: this.requestId(req),
        },
      });

      return {
        failure: null,
        userId: user.id,
        roles: user.userRoles.map((item) => item.role),
        status: user.status,
        deviceId: claims.deviceId,
        refreshToken: nextRefreshToken,
      };
    });

    if (outcome.failure !== null) {
      this.clearCookies(res, req);
      throw new UnauthorizedException(outcome.failure);
    }
    const result = outcome;

    this.setCookies(
      res,
      req,
      this.issueAccess(
        result.userId,
        result.roles,
        result.status,
        result.deviceId,
      ),
      result.refreshToken,
      result.deviceId,
    );

    return { userId: result.userId, deviceId: result.deviceId };
  }

  async signOut(
    refreshToken: string | undefined,
    req: Request,
    res: Response,
    allDevices = false,
  ) {
    if (refreshToken) {
      try {
        const claims = verifyJwt<RefreshClaims>(
          refreshToken,
          this.jwtSecret(),
          'refresh',
        );

        if (allDevices) {
          await this.db.$transaction(async (tx) => {
            await tx.refreshToken.updateMany({
              where: { userId: claims.sub, status: SessionStatus.ACTIVE },
              data: { status: SessionStatus.REVOKED, revokedAt: new Date() },
            });
            await tx.deviceSession.updateMany({
              where: { userId: claims.sub, status: SessionStatus.ACTIVE },
              data: { status: SessionStatus.REVOKED, revokedAt: new Date() },
            });
            await tx.auditLog.create({
              data: {
                actorId: claims.sub,
                action: 'AUTH_LOGOUT_ALL',
                targetType: 'User',
                targetId: claims.sub,
                ipAddress: this.clientIp(req),
                requestId: this.requestId(req),
              },
            });
          });
        } else {
          await this.db.$transaction(async (tx) => {
            await this.revokeDevice(tx, claims.sub, claims.deviceId);
            await tx.auditLog.create({
              data: {
                actorId: claims.sub,
                action: 'AUTH_LOGOUT',
                targetType: 'DeviceSession',
                ipAddress: this.clientIp(req),
                requestId: this.requestId(req),
              },
            });
          });
        }
      } catch {
      }
    }

    this.clearCookies(res, req);
    return { signedOut: true, allDevices };
  }

  private revokeLockedUntil(current: { createdAt: Date } | undefined): Date | null {
    if (!current) return null;
    const { trustSeconds } = this.config.getOrThrow<{ trustSeconds: number }>('limits.devices');
    const until = new Date(current.createdAt.getTime() + trustSeconds * 1000);
    return until.getTime() > Date.now() ? until : null;
  }

  private assertMayRevoke(current: { createdAt: Date } | undefined, target: { createdAt: Date }, until: Date | null) {
    if (!current || !until || target.createdAt.getTime() >= current.createdAt.getTime()) return;
    const hours = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 3_600_000));
    throw new ForbiddenException(ERRORS.DEVICE_TOO_NEW_TO_REVOKE(hours));
  }

  async findAllSessions(userId: string, currentDeviceId?: string) {
    const rows = await this.db.deviceSession.findMany({
      where: { userId, status: SessionStatus.ACTIVE },
      orderBy: { lastSeenAt: 'desc' },
    });
    const current = rows.find((row) => !!currentDeviceId && row.deviceId === currentDeviceId);
    const lockedUntil = this.revokeLockedUntil(current);
    return rows.map((row) => {
      const isCurrent = row === current;
      const locked = !!current && !!lockedUntil && !isCurrent && row.createdAt.getTime() < current.createdAt.getTime();
      return {
        id: row.id,
        status: row.status,
        userAgent: row.userAgent,
        ipAddress: row.ipAddress,
        panel: row.panel,
        createdAt: row.createdAt,
        lastSeenAt: row.lastSeenAt,
        isCurrent,
        canRevoke: !locked,
        revokeLockedUntil: locked ? lockedUntil : null,
      };
    });
  }

  async revokeSession(userId: string, sessionOrDeviceId: string, currentDeviceId: string, req: Request) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionOrDeviceId);
    const result = await this.db.$transaction(async (tx) => {
      const session = await tx.deviceSession.findFirst({
        where: { userId, OR: [{ deviceId: sessionOrDeviceId }, ...(isUuid ? [{ id: sessionOrDeviceId }] : [])] },
      });
      if (!session) throw new BadRequestException(ERRORS.DEVICE_SESSION_NOT_FOUND);

      if (session.deviceId !== currentDeviceId) {
        const current = await tx.deviceSession.findUnique({
          where: { userId_deviceId: { userId, deviceId: currentDeviceId } },
        });
        this.assertMayRevoke(current ?? undefined, session, this.revokeLockedUntil(current ?? undefined));
      }

      await this.revokeDevice(tx, userId, session.deviceId);
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'AUTH_SESSION_REVOKED',
          targetType: 'DeviceSession',
          ipAddress: this.clientIp(req),
          requestId: this.requestId(req),
        },
      });
      return true;
    });

    return { revoked: result };
  }

  async revokeOtherSessions(userId: string, currentDeviceId: string, req: Request) {
    const revoked = await this.db.$transaction(async (tx) => {
      const current = await tx.deviceSession.findUnique({
        where: { userId_deviceId: { userId, deviceId: currentDeviceId } },
      });
      const others = await tx.deviceSession.findMany({
        where: { userId, status: SessionStatus.ACTIVE, NOT: { deviceId: currentDeviceId } },
        select: { deviceId: true, createdAt: true },
      });
      const until = this.revokeLockedUntil(current ?? undefined);
      for (const other of others) this.assertMayRevoke(current ?? undefined, other, until);
      for (const { deviceId } of others) await this.revokeDevice(tx, userId, deviceId);
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'AUTH_OTHER_SESSIONS_REVOKED',
          targetType: 'User',
          targetId: userId,
          after: { count: others.length },
          ipAddress: this.clientIp(req),
          requestId: this.requestId(req),
        },
      });
      return others.length;
    });
    return { revoked };
  }

  private devCode(issued: object): { developmentCode?: string } {
    const enabled =
      process.env.OTP_DEV_ECHO_AUTH === 'true' && this.config.get<string>('app.environment') !== 'production';
    const code = (issued as { developmentCode?: string }).developmentCode;
    return enabled && code ? { developmentCode: code } : {};
  }

  private async createSession(
    userId: string,
    roles: Role[],
    status: UserStatus,
    req: Request,
    res: Response,
  ) {
    let deviceId = this.deviceCookie(req);
    if (!deviceId) deviceId = newOpaqueToken(32);

    const maxDevices = this.config.get<number>('auth.maxDevices', 2);
    const result = await this.withSerializableRetry(async (tx) => {
      const existing = await tx.deviceSession.findUnique({
        where: { userId_deviceId: { userId, deviceId } },
      });

      if (!existing) {
        const activeCount = await tx.deviceSession.count({
          where: { userId, status: SessionStatus.ACTIVE },
        });
        if (activeCount >= maxDevices) {
          throw new ForbiddenException(
            ERRORS.MAX_ACTIVE_DEVICES(maxDevices),
          );
        }
      }

      const session = existing
        ? await tx.deviceSession.update({
            where: { id: existing.id },
            data: {
              status: SessionStatus.ACTIVE,
              lastSeenAt: new Date(),
              revokedAt: null,
              ...(existing.status === SessionStatus.ACTIVE ? {} : { createdAt: new Date() }),
              ...this.deviceInfo(req),
            },
          })
        : await tx.deviceSession.create({
            data: { userId, deviceId, ...this.deviceInfo(req) },
          });

      await tx.refreshToken.updateMany({
        where: {
          userId,
          deviceId,
          status: SessionStatus.ACTIVE,
        },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
        },
      });

      const familyId = randomUUID();
      const tokenId = randomUUID();
      const refreshToken = this.issueRefresh(
        userId,
        deviceId,
        familyId,
        tokenId,
      );

      await tx.refreshToken.create({
        data: {
          id: tokenId,
          userId,
          deviceId,
          familyId,
          tokenHash: await bcrypt.hash(refreshToken, 12),
          expiresAt: this.refreshExpiry(),
          status: SessionStatus.ACTIVE,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'AUTH_LOGIN_COMPLETED',
          targetType: 'DeviceSession',
          ipAddress: this.clientIp(req),
          requestId: this.requestId(req),
        },
      });

      return { sessionId: session.id, refreshToken };
    });

    this.setCookies(
      res,
      req,
      this.issueAccess(userId, roles, status, deviceId),
      result.refreshToken,
      deviceId,
    );

    return {
      userId,
      deviceId,
      sessionId: result.sessionId,
    };
  }

  private revokeDevice(
    tx: Prisma.TransactionClient,
    userId: string,
    deviceId: string,
  ) {
    return Promise.all([
      tx.refreshToken.updateMany({
        where: {
          userId,
          deviceId,
          status: SessionStatus.ACTIVE,
        },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
        },
      }),
      tx.deviceSession.updateMany({
        where: {
          userId,
          deviceId,
          status: SessionStatus.ACTIVE,
        },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
        },
      }),
    ]);
  }

  private revokeFamily(
    tx: Prisma.TransactionClient,
    userId: string,
    familyId: string,
    deviceId: string,
  ) {
    return Promise.all([
      tx.refreshToken.updateMany({
        where: {
          userId,
          familyId,
          status: SessionStatus.ACTIVE,
        },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
        },
      }),
      tx.deviceSession.updateMany({
        where: {
          userId,
          deviceId,
          status: SessionStatus.ACTIVE,
        },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
        },
      }),
    ]);
  }

  private issueAccess(
    sub: string,
    roles: Role[],
    status: UserStatus,
    deviceId: string,
  ) {
    return createJwt<AccessClaims>(
      { sub, roles, status, deviceId, type: 'access' },
      this.jwtSecret(),
      this.config.get<number>('auth.accessTtlSeconds', 900),
    );
  }

  private issueRefresh(
    sub: string,
    deviceId: string,
    familyId: string,
    jti: string,
  ) {
    return createJwt<RefreshClaims>(
      { sub, deviceId, familyId, jti, type: 'refresh' },
      this.jwtSecret(),
      this.config.get<number>('auth.refreshTtlSeconds', 30 * 60),
    );
  }

  private refreshExpiry() {
    return new Date(
      Date.now() + this.config.get<number>('auth.refreshTtlSeconds', 30 * 60) * 1000,
    );
  }

  private jwtSecret() {
    const secret = this.config.get<string>('auth.jwtSecret');
    if (!secret || secret.length < 32) {
      throw new Error(ERRORS.JWT_SECRET_SHORT);
    }
    return secret;
  }

  private deviceInfo(req: Request) {
    const agent = req.headers?.['user-agent'];
    return {
      userAgent: (Array.isArray(agent) ? agent[0] : agent)?.slice(0, 400) ?? null,
      ipAddress: this.clientIp(req) ?? null,
      panel: panelOf(req),
    };
  }

  private deviceCookie(req: Request) {
    const name = authCookieNames(panelOf(req)).device;
    const header = req.headers.cookie;
    if (typeof header !== 'string') return undefined;
    const raw = header
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1);
    return raw && /^[A-Za-z0-9_-]{32,128}$/.test(raw) ? raw : undefined;
  }

  private cookieBase() {
    const sameSite = this.config.get<'lax' | 'strict' | 'none'>(
      'auth.cookieSameSite',
      'lax',
    );
    return {
      httpOnly: true,
      secure:
        sameSite === 'none'
          ? true
          : this.config.get<boolean>('auth.cookieSecure', true),
      sameSite,
      ...(this.config.get<string | undefined>('auth.cookieDomain')
        ? { domain: this.config.get<string>('auth.cookieDomain') }
        : {}),
    } as const;
  }

  private setCookies(
    res: Response,
    req: Request,
    accessToken: string,
    refreshToken: string,
    deviceId: string,
  ) {
    const base = this.cookieBase();
    const names = authCookieNames(panelOf(req));
    res.cookie(names.access, accessToken, {
      ...base,
      path: '/',
      maxAge: this.config.get<number>('auth.accessTtlSeconds', 900) * 1000,
    });
    res.cookie(names.refresh, refreshToken, {
      ...base,
      path: '/api/v1/auth',
      maxAge: this.config.get<number>('auth.refreshTtlSeconds', 30 * 60) * 1000,
    });
    res.cookie(names.device, deviceId, {
      ...base,
      path: '/api/v1/auth',
      maxAge: DEVICE_COOKIE_TTL_DAYS * 86_400_000,
    });
  }

  private clearCookies(res: Response, req: Request) {
    const base = this.cookieBase();
    const names = authCookieNames(panelOf(req));
    res.clearCookie(names.access, { ...base, path: '/' });
    res.clearCookie(names.refresh, { ...base, path: '/api/v1/auth' });
    res.clearCookie(names.device, { ...base, path: '/api/v1/auth' });
  }

  private normalizePhone(value: string) {
    const digits = value.replace(/\D/g, '');
    if (!/^998\d{9}$/.test(digits)) {
      throw new BadRequestException(ERRORS.INVALID_PHONE);
    }
    return `+${digits}`;
  }

  private clientIp(req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    const candidate = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0];
    return (candidate || req.ip || '').slice(0, 64) || undefined;
  }

  private requestId(req: Request) {
    return String((req as Request & { id?: string }).id ?? '').slice(0, 100) || undefined;
  }

  private async getRequiredPolicies() {
    const policies = await this.db.policyVersion.findMany({
      where: {
        status: PolicyStatus.PUBLISHED,
        type: {
          in: [PolicyType.TERMS, PolicyType.PRIVACY, PolicyType.PLATFORM_RULES],
        },
      },
      orderBy: [{ type: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, type: true },
    });

    const latest = new Map<PolicyType, { id: string; type: PolicyType }>();
    for (const policy of policies) {
      if (!latest.has(policy.type)) latest.set(policy.type, policy);
    }
    return [...latest.values()];
  }

  private async withSerializableRetry<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.db.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2034' ||
          attempt === maxAttempts
        ) {
          throw error;
        }
      }
    }
    throw new Error(ERRORS.TRANSACTION_RETRY_EXCEEDED);
  }
}
