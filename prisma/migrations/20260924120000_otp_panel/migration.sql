-- AlterTable: OTP limitlari har bir frontend paneli (mijoz / usta / admin) uchun alohida hisoblanadi.
ALTER TABLE "otp_codes" ADD COLUMN "panel" VARCHAR(16);
