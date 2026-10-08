-- Ustaning hududi (14 hudud kaliti) — katalogda hudud bo‘yicha filtr uchun.
ALTER TABLE "master_profiles" ADD COLUMN "region" VARCHAR(32);
CREATE INDEX "master_profiles_region_idx" ON "master_profiles"("region");
