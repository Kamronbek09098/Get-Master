-- Profil rasmi: foydalanuvchi va usta rasm qo'ya oladi; superadmin hammasini boshqaradi (admin akkauntlar uchun alohida ruxsat).
ALTER TYPE "MediaAssetKind" ADD VALUE IF NOT EXISTS 'USER_AVATAR';

ALTER TABLE "users" ADD COLUMN "avatar_asset_id" UUID;
ALTER TABLE "users" ADD COLUMN "avatar_updated_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "admin_avatar_allowed" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "users_avatar_asset_id_key" ON "users"("avatar_asset_id");

ALTER TABLE "users" ADD CONSTRAINT "users_avatar_asset_id_fkey" FOREIGN KEY ("avatar_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
