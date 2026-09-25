CREATE TYPE "PortfolioStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "master_portfolio"
  ADD COLUMN "status" "PortfolioStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "reviewed_by_id" UUID,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "reject_reason" TEXT;

ALTER TABLE "master_portfolio" ALTER COLUMN "status" SET DEFAULT 'PENDING';

CREATE INDEX "master_portfolio_status_createdAt_idx" ON "master_portfolio"("status", "createdAt");
