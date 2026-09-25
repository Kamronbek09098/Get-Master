ALTER TABLE "messages" ADD COLUMN "reply_to_id" UUID;
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "messages_reply_to_id_idx" ON "messages"("reply_to_id");

CREATE TABLE "message_reactions" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "panel" VARCHAR(16) NOT NULL DEFAULT '',
    "emoji" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "message_reactions_messageId_userId_panel_key" ON "message_reactions"("messageId", "userId", "panel");
CREATE INDEX "message_reactions_messageId_idx" ON "message_reactions"("messageId");
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
