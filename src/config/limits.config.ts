import { registerAs } from '@nestjs/config';
import { intEnv } from './env.util';

export default registerAs('limits', () => ({
  rate: {
    register: { limit: intEnv('RATE_LIMIT_REGISTER_MAX', 3), windowSeconds: intEnv('RATE_LIMIT_REGISTER_WINDOW_SECONDS', 3600) },
    login: { limit: intEnv('RATE_LIMIT_LOGIN_MAX', 30), windowSeconds: intEnv('RATE_LIMIT_LOGIN_WINDOW_SECONDS', 900) },
    otpRequest: { limit: intEnv('RATE_LIMIT_OTP_REQUEST_MAX', 5), windowSeconds: intEnv('RATE_LIMIT_OTP_REQUEST_WINDOW_SECONDS', 3600) },
    otpVerify: { limit: intEnv('RATE_LIMIT_OTP_VERIFY_MAX', 10), windowSeconds: intEnv('RATE_LIMIT_OTP_VERIFY_WINDOW_SECONDS', 900) },
    chat: {
      limit: intEnv('RATE_LIMIT_CHAT_MAX', 30),
      windowSeconds: intEnv('RATE_LIMIT_CHAT_WINDOW_SECONDS', 60),
      ipLimit: intEnv('RATE_LIMIT_CHAT_IP_MAX', 300),
    },
  },
  otp: {
    ttlSeconds: intEnv('OTP_TTL_SECONDS', 300),
    resendSeconds: intEnv('OTP_RESEND_SECONDS', 60),
    windowSeconds: intEnv('OTP_WINDOW_SECONDS', 3600),
    maxRequestsPerWindow: intEnv('OTP_MAX_REQUESTS', 5),
    ipMultiplier: intEnv('OTP_IP_MULTIPLIER', 3),
    maxAttempts: intEnv('OTP_MAX_ATTEMPTS', 5),
  },
  devices: {
    trustSeconds: intEnv('DEVICE_TRUST_SECONDS', 86400),
  },
  login: {
    maxFailures: intEnv('LOGIN_MAX_FAILURES', 10),
    failureWindowSeconds: intEnv('LOGIN_FAILURE_WINDOW_SECONDS', 600),
    lockSeconds: intEnv('LOGIN_LOCK_SECONDS', 120),
  },
}));
