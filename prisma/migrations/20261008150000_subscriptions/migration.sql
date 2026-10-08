-- Obuna tizimi: mijoz «Plus», usta «Pro».
CREATE TYPE "SubscriptionAudience" AS ENUM ('CUSTOMER', 'MASTER');
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELED', 'REJECTED');

CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "audience" "SubscriptionAudience" NOT NULL,
    "plan_code" VARCHAR(32) NOT NULL,
    "months" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'UZS',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "source" VARCHAR(16) NOT NULL DEFAULT 'PURCHASE',
    "method" VARCHAR(24),
    "reference" VARCHAR(24) NOT NULL,
    "note" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subscriptions_reference_key" ON "subscriptions"("reference");
CREATE INDEX "subscriptions_userId_audience_status_ends_at_idx" ON "subscriptions"("userId", "audience", "status", "ends_at");
CREATE INDEX "subscriptions_status_createdAt_idx" ON "subscriptions"("status", "createdAt");
CREATE INDEX "subscriptions_status_ends_at_idx" ON "subscriptions"("status", "ends_at");
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "master_profiles" ADD COLUMN "is_pro" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "master_profiles" ADD COLUMN "pro_until" TIMESTAMP(3);
ALTER TABLE "problem_requests" ADD COLUMN "is_priority" BOOLEAN NOT NULL DEFAULT false;
