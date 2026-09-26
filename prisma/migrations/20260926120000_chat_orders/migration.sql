-- Chatdan yuborilgan buyurtma xabari
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'ORDER';
ALTER TABLE "messages" ADD COLUMN "order_id" UUID;
ALTER TABLE "messages" ADD CONSTRAINT "messages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "messages_order_id_idx" ON "messages"("order_id");
