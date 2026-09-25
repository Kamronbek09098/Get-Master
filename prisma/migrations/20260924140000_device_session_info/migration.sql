-- AlterTable: faol qurilmalar ro'yxati uchun qurilma ma'lumotlari.
ALTER TABLE "device_sessions"
  ADD COLUMN "user_agent" VARCHAR(400),
  ADD COLUMN "ip_address" VARCHAR(64),
  ADD COLUMN "panel" VARCHAR(16);
