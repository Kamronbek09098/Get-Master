# Architecture

The application uses a modular NestJS architecture:

`Controller -> Service -> Prisma -> PostgreSQL`

Cross-cutting concerns are global:

- request IDs
- DTO validation
- authentication
- role authorization
- safe exception envelopes
- technical HTTP logging
- success response envelopes

Authentication state is represented by `User`, `UserRole`, `DeviceSession`, `RefreshToken`, `OtpCode`, `PolicyVersion`, and `PolicyAcceptance` rather than legacy single-role/device models.
