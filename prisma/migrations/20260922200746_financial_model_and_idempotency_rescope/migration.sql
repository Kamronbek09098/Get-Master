-- DropIndex
DROP INDEX "idempotency_keys_key_key";

-- DropIndex
DROP INDEX "idempotency_keys_userId_endpoint_idx";

-- AlterTable
ALTER TABLE "idempotency_keys" ADD COLUMN     "method" VARCHAR(10) NOT NULL,
ALTER COLUMN "userId" SET NOT NULL,
ALTER COLUMN "request_hash" SET NOT NULL,
ALTER COLUMN "expires_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "final_price",
ADD COLUMN     "additional_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "completion_submitted_at" TIMESTAMP(3),
ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'UZS',
ADD COLUMN     "final_amount" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "master_amount" DECIMAL(14,2),
ADD COLUMN     "original_amount" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "platform_fee" DECIMAL(14,2);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_userId_method_endpoint_key_key" ON "idempotency_keys"("userId", "method", "endpoint", "key");

