-- AlterTable
ALTER TABLE "master_portfolio" ADD COLUMN     "media_asset_id" UUID;

-- AlterTable
ALTER TABLE "master_services" ADD COLUMN     "estimated_minutes" INTEGER;

-- AlterTable
ALTER TABLE "master_verifications" ADD COLUMN     "media_asset_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "master_portfolio_media_asset_id_key" ON "master_portfolio"("media_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "master_verifications_media_asset_id_key" ON "master_verifications"("media_asset_id");

-- AddForeignKey
ALTER TABLE "master_portfolio" ADD CONSTRAINT "master_portfolio_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_verifications" ADD CONSTRAINT "master_verifications_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

