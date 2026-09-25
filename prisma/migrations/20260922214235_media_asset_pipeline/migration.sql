-- CreateEnum
CREATE TYPE "MediaAssetStatus" AS ENUM ('UPLOADING', 'QUARANTINED', 'SCANNING', 'PROCESSING', 'READY', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "MediaAssetKind" AS ENUM ('PROBLEM_ATTACHMENT', 'WORK_PROOF', 'MESSAGE_ATTACHMENT', 'MASTER_VERIFICATION_DOCUMENT', 'MASTER_PORTFOLIO');

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "uploaderId" UUID NOT NULL,
    "kind" "MediaAssetKind" NOT NULL,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'UPLOADING',
    "quarantine_key" TEXT,
    "original_key" TEXT,
    "thumbnail_key" TEXT,
    "medium_key" TEXT,
    "original_name" VARCHAR(255) NOT NULL,
    "declared_mime_type" VARCHAR(150) NOT NULL,
    "detected_mime_type" VARCHAR(150),
    "size_bytes" BIGINT NOT NULL,
    "scan_result" VARCHAR(50),
    "rejection_reason" TEXT,
    "linked_resource_type" VARCHAR(50),
    "linked_resource_id" UUID,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "cleaned_up_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_assets_uploaderId_status_idx" ON "media_assets"("uploaderId", "status");

-- CreateIndex
CREATE INDEX "media_assets_linked_resource_type_linked_resource_id_idx" ON "media_assets"("linked_resource_type", "linked_resource_id");

-- CreateIndex
CREATE INDEX "media_assets_status_updatedAt_idx" ON "media_assets"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

