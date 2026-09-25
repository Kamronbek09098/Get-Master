import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export type RateLimitPolicy = 'register' | 'login' | 'otpRequest' | 'otpVerify' | 'chat';

export interface RateLimitOptions {
  scope: 'ip' | 'ip+phone' | 'user';
  policy?: RateLimitPolicy;
  limit?: number;
  windowSeconds?: number;
  ipLimit?: number;
}

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
