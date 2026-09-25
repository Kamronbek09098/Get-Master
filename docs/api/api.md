# API Baseline

Global API prefix: `/api/v1`

Authentication endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/verify-registration`
- `POST /auth/verify-otp`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/sessions`
- `POST /auth/sessions/:deviceId/revoke`
- `POST /otp/request`

Authentication is cookie-based. Access and refresh tokens are not returned in JSON responses.
