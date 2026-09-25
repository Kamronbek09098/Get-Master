# Merge Review — Get-Master

## Source projects reviewed

1. Get-Master TZ-compliant project: retained as the structural/domain source of truth.
2. 3-oy marcketplace: used selectively for implementation patterns where they fit the Get-Master schema and security requirements.

## Adopted strengths

- bcrypt-based password and OTP hashing.
- Device-session based authentication.
- Refresh-token rotation and explicit token families.
- Historical refresh-token records for reuse detection.
- Multiple roles through `UserRole[]`.
- DTO validation with whitelist/forbid-non-whitelisted behavior.
- Global authentication and authorization guards.
- Request-ID propagation and safe HTTP logging.
- Audit logging for authentication state changes.
- Security response headers.

## Deliberately not copied

The second project contains a legacy `User.role`, `Devices`, `hashedPassword`, integer IDs, and `Token/Crypt` abstractions. Those conflict with the Get-Master UUID/UserRole/DeviceSession/RefreshToken schema and were not copied.

## Structural rule

The original Get-Master directory structure is preserved. Only implementation corrections and narrowly necessary supporting files are added.
