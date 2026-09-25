# Security Baseline

## Authentication

Access tokens are short-lived JWTs. Refresh tokens are stored in HttpOnly cookies, hashed at rest, rotated on every refresh, and retained as historical records so reuse can be detected.

Each refresh token carries a signed `jti` equal to its database row ID. A revoked token presented again is treated as reuse and revokes its refresh-token family and device session.

## Passwords and OTP

Passwords and OTP values are never stored in plaintext. bcrypt is used for hashing. OTP records expire, are single-use, and have bounded verification attempts. OTP issuance is rate-limited by phone and request IP.

## Sessions

Every authenticated device has a `DeviceSession`. Revoking a session revokes active refresh tokens for that device. The authentication guard checks both JWT validity and the live device-session state.

## Authorization

Users can have multiple roles through `UserRole`. `AuthGuard` establishes identity; `RolesGuard` performs role authorization.

## Logging and audit

HTTP logs contain technical metadata only. Authentication state changes are written to `AuditLog`. Secrets, passwords, OTP codes, refresh tokens, and authorization headers must not be logged.
