-- CreateEnum
CREATE TYPE "CallMode" AS ENUM ('AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ACTIVE', 'ENDED', 'DECLINED', 'MISSED', 'CANCELED', 'FAILED');

-- CreateTable
CREATE TABLE "calls" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "callerId" UUID NOT NULL,
    "calleeId" UUID NOT NULL,
    "caller_panel" VARCHAR(16),
    "callee_panel" VARCHAR(16),
    "mode" "CallMode" NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
    "end_reason" VARCHAR(32),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answered_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calls_conversationId_created_at_idx" ON "calls"("conversationId", "created_at");

-- CreateIndex
CREATE INDEX "calls_callerId_status_idx" ON "calls"("callerId", "status");

-- CreateIndex
CREATE INDEX "calls_calleeId_status_idx" ON "calls"("calleeId", "status");

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_calleeId_fkey" FOREIGN KEY ("calleeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
