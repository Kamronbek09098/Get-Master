-- Superadmin adminga «yangi adminlar yaratish» huquqini va unga qaysi huquqlarni bera olishini belgilaydi.
ALTER TABLE "users" ADD COLUMN "can_create_admins" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "grantable_permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN "created_by_admin_id" UUID;
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
