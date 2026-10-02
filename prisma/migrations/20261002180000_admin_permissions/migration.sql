-- Oddiy adminning huquqlari (bo'limlar ro'yxati)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
