# Database Notes

The PostgreSQL schema is the source of truth for domain entities.

## Refresh tokens

`RefreshToken.id` is the refresh-token `jti`. Historical rows are intentionally retained after rotation. Do not add a unique constraint on `(userId, deviceId)` to `RefreshToken`: a device must be able to have a revoked historical token and a new active token simultaneously.

`tokenHash` remains unique. `familyId` groups a refresh-token rotation family and is used for reuse detection.

## OTP

`OtpCode` stores the hashed code, purpose, status, attempt counter, expiry, verification timestamp, and originating IP address for abuse controls.

## Policies

Registration accepts only the latest published versions of the required policy types: Terms, Privacy, and Platform Rules. Policy acceptance is persisted with the client IP.
