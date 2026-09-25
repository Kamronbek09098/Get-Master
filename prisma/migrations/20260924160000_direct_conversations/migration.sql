ALTER TYPE "ConversationType" ADD VALUE IF NOT EXISTS 'DIRECT';

ALTER TABLE "conversations" ADD COLUMN "direct_key" VARCHAR(80);

CREATE UNIQUE INDEX "conversations_direct_key_key" ON "conversations"("direct_key");
