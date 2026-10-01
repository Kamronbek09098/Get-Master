-- Markazsiz ish radiusini tozalash va kelgusida bunday holatning oldini olish.
UPDATE "master_profiles" SET "work_radius_km" = NULL WHERE "work_radius_km" IS NOT NULL AND ("latitude" IS NULL OR "longitude" IS NULL);
ALTER TABLE "master_profiles" ADD CONSTRAINT "master_profiles_radius_needs_center" CHECK ("work_radius_km" IS NULL OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL));
