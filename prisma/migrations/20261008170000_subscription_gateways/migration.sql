-- Obuna: Click/Payme/Uzum orqali avtomatik faollashish va karta cheki.
ALTER TYPE "MediaAssetKind" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RECEIPT';
ALTER TABLE "subscriptions" ADD COLUMN "provider_tx_id" VARCHAR(128);
ALTER TABLE "subscriptions" ADD COLUMN "provider_meta" JSONB;
ALTER TABLE "subscriptions" ADD COLUMN "paid_at" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN "receipt_asset_id" UUID;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_receipt_asset_id_fkey" FOREIGN KEY ("receipt_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "subscriptions_method_provider_tx_id_idx" ON "subscriptions"("method", "provider_tx_id");
