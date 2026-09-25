# Deployment

## Talablar

- Node.js 22, pnpm 9
- PostgreSQL 16
- Redis 7
- S3-mos obyekt saqlash (MinIO yoki boshqa)
- ClamAV (fayllarni tekshirish uchun)

## Lokal ishga tushirish

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed
pnpm start:dev
```

API manzili: `http://localhost:3000/api/v1`, holat tekshiruvi: `GET /api/v1/health` va `GET /api/v1/health/ready`.

Frontend:

```bash
cd apps/web
npm ci
npm run dev
```

## Production

1. Docker image yig‘ish: `docker build -t getmaster-api .`
2. Muhit o‘zgaruvchilarini secret manager orqali berish (`.env.example`dagi barcha kalitlar).
3. Migratsiyalarni qo‘llash: `pnpm db:migrate:deploy` (`db push` productionda ishlatilmaydi).
4. Konteynerni ishga tushirish: `docker run -p 3000:3000 --env-file <secrets> getmaster-api`.
5. Nginx orqali HTTPS va `/api` ni backendga, qolganini frontend statik fayllariga yo‘naltirish.

## Tekshiruvlar (CI)

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

Staging va production alohida muhitlarda ishlaydi. Har bir relizdan oldin staging’da tekshiriladi.
