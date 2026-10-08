-- Xizmat rejimlari: mijoz manzilida (usta boradi) yoki ustaning joyida (mijoz boradi).
CREATE TYPE "ServiceMode" AS ENUM ('AT_CUSTOMER', 'AT_MASTER');

ALTER TABLE "service_categories" ADD COLUMN "modes" "ServiceMode"[] NOT NULL DEFAULT ARRAY['AT_CUSTOMER']::"ServiceMode"[];
ALTER TABLE "master_profiles" ADD COLUMN "service_modes" "ServiceMode"[] NOT NULL DEFAULT ARRAY['AT_CUSTOMER']::"ServiceMode"[];
ALTER TABLE "master_profiles" ADD COLUMN "place_address" VARCHAR(255);
ALTER TABLE "problem_requests" ADD COLUMN "service_mode" "ServiceMode" NOT NULL DEFAULT 'AT_CUSTOMER';
