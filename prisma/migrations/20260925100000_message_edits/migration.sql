CREATE TABLE "message_edits" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "previous_text" TEXT,
    "edited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_edits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "message_edits_messageId_edited_at_idx" ON "message_edits"("messageId", "edited_at");

ALTER TABLE "message_edits" ADD CONSTRAINT "message_edits_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
