-- Google orqali ro‘yxatdan o‘tish/kirish: Google hisobining barqaror identifikatori (sub).
ALTER TABLE "users" ADD COLUMN "google_id" VARCHAR(64);
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
