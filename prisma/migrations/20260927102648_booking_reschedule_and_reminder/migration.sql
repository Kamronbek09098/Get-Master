-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "proposed_at" TIMESTAMP(3),
ADD COLUMN     "proposed_by_id" UUID,
ADD COLUMN     "proposed_start_at" TIMESTAMP(3),
ADD COLUMN     "reminder_sent_at" TIMESTAMP(3);
