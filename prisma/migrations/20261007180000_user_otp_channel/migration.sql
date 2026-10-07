-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('EMAIL', 'PHONE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "otp_channel" "OtpChannel" NOT NULL DEFAULT 'EMAIL';
