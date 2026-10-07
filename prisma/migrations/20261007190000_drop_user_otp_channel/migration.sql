-- AlterTable
ALTER TABLE "users" DROP COLUMN "otp_channel";

-- DropEnum
DROP TYPE "OtpChannel";
