import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { verifyJwt, type AccessClaims } from '../types/auth.types';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { TooManyRequestsException } from '../exceptions/business.exception';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';
import { ERRORS } from '../constants/error-messages';
import { authCookieNames, panelOf } from '../utils/panel';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const declared = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!declared) return true;
    const options = this.resolve(declared);

    const req = context.switchToHttp().getRequest();
    const ip = (req.ip ?? req.headers?.['x-forwarded-for'] ?? 'unknown').toString().split(',')[0].trim();
    const route = `${req.method}:${req.route?.path ?? req.originalUrl}:${panelOf(req) ?? 'any'}`;

    let bucketKey = `ratelimit:${route}:ip:${ip}`;
    if (options.scope === 'ip+phone' && req.body?.phone) {
      bucketKey = `ratelimit:${route}:ip+phone:${ip}:${req.body.phone}`;
    }

    if (options.scope === 'user') {
      const userId = this.userIdFrom(req.headers?.cookie, authCookieNames(panelOf(req)).access);
      if (userId) {
        const ipBucket = await this.redis.consume(
          `ratelimit:${route}:ip:${ip}`,
          options.ipLimit ?? options.limit * 5,
          options.windowSeconds,
        );
        if (!ipBucket.allowed) throw new TooManyRequestsException(ERRORS.RATE_LIMIT_EXCEEDED);
        bucketKey = `ratelimit:${route}:user:${userId}`;
      }
    }

    const { allowed } = await this.redis.consume(bucketKey, options.limit, options.windowSeconds);
    if (!allowed) throw new TooManyRequestsException(ERRORS.RATE_LIMIT_EXCEEDED);
    return true;
  }

  private resolve(declared: RateLimitOptions): Required<Pick<RateLimitOptions, 'scope' | 'limit' | 'windowSeconds'>> & { ipLimit?: number } {
    const configured = declared.policy
      ? this.config.get<{ limit: number; windowSeconds: number; ipLimit?: number }>(`limits.rate.${declared.policy}`)
      : undefined;
    const limit = configured?.limit ?? declared.limit;
    const windowSeconds = configured?.windowSeconds ?? declared.windowSeconds;
    if (limit === undefined || windowSeconds === undefined) {
      throw new Error(`RateLimit sozlamasi to'liq emas `);
    }
    return { scope: declared.scope, limit, windowSeconds, ipLimit: configured?.ipLimit ?? declared.ipLimit };
  }

  private userIdFrom(cookieHeader: unknown, cookieName: string): string | null {
    if (typeof cookieHeader !== 'string') return null;
    const token = cookieHeader
      .split(';')
      .map((part) => part.trim().split('='))
      .find(([key]) => key === cookieName)?.[1];
    if (!token) return null;
    try {
      return verifyJwt<AccessClaims>(token, this.config.getOrThrow<string>('auth.jwtSecret'), 'access').sub ?? null;
    } catch {
      return null;
    }
  }
}

