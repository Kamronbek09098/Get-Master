-- Superadmin: adminlarni yaratish va boshqarish. Mavjud barcha adminlar superadmin bo'ladi (ular hozirgi to'liq huquqni saqlaydi).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_super_admin" BOOLEAN NOT NULL DEFAULT false;
UPDATE "users" SET "is_super_admin" = true WHERE "id" IN (SELECT "userId" FROM "user_roles" WHERE "role" = 'ADMIN') AND "deleted_at" IS NULL;
