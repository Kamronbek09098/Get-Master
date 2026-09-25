-- AlterTable
ALTER TABLE "work_proofs" ADD COLUMN "media_asset_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "work_proofs_media_asset_id_key" ON "work_proofs"("media_asset_id");

-- AddForeignKey
ALTER TABLE "work_proofs" ADD CONSTRAINT "work_proofs_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
