-- AlterTable
ALTER TABLE "master_portfolio" ADD COLUMN     "before_media_asset_id" UUID;

-- CreateTable
CREATE TABLE "favorite_masters" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "master_id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_masters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "favorite_masters_master_id_idx" ON "favorite_masters"("master_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_masters_customer_id_master_id_key" ON "favorite_masters"("customer_id", "master_id");

-- CreateIndex
CREATE UNIQUE INDEX "master_portfolio_before_media_asset_id_key" ON "master_portfolio"("before_media_asset_id");

-- AddForeignKey
ALTER TABLE "master_portfolio" ADD CONSTRAINT "master_portfolio_before_media_asset_id_fkey" FOREIGN KEY ("before_media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_masters" ADD CONSTRAINT "favorite_masters_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_masters" ADD CONSTRAINT "favorite_masters_master_id_fkey" FOREIGN KEY ("master_id") REFERENCES "master_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

