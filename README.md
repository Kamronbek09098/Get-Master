# Get-Master

Production-oriented NestJS marketplace backend aligned to the Get-Master domain model and API/security requirements.

## Architecture

`Controller -> Service -> Prisma -> PostgreSQL`

Cross-cutting concerns are centralized in global validation, authentication/authorization guards, exception filtering, request IDs, logging, and response envelopes.

## Authentication

- Phone + password authentication.
- Registration remains `PENDING` until OTP verification.
- Required published policy versions must be accepted during registration.
- bcrypt password/OTP/refresh-token hashing.
- Short-lived access JWT.
- HttpOnly refresh-token cookie.
- Refresh-token rotation with historical token records.
- Refresh-token family reuse detection.
- Device sessions with an active-device limit.
- Current-device and all-device logout/revocation.
- Role-based authorization through `UserRole[]`.
- Authentication audit records.

## Important database requirement

Refresh-token rotation intentionally stores historical refresh-token rows. The previous `@@unique([userId, deviceId])` constraint was removed from `RefreshToken`; otherwise rotation could not create the replacement row while retaining the revoked token required for reuse detection.

`OtpCode.ipAddress` is stored for abuse-control auditing and rate limiting.

Run Prisma validation/generation before starting the application:

```bash
pnpm db:format
pnpm db:validate
pnpm db:generate
pnpm db:migrate:dev
```

Production deployments should use:

```bash
pnpm db:migrate:deploy
pnpm build
pnpm start
```

## Environment

At minimum:

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `JWT_SECRET` (32+ characters)
- `CORS_ORIGINS`
- `ACCESS_TOKEN_TTL_SECONDS`
- `REFRESH_TOKEN_TTL_DAYS`
- `MAX_ACTIVE_DEVICES`
- `AUTH_COOKIE_SECURE`
- `AUTH_COOKIE_SAME_SITE`
- `AUTH_COOKIE_DOMAIN` (optional)

Production must use HTTPS and secure cookies.
