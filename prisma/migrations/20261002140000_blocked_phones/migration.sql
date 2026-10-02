-- Admin qayta ro'yxatdan o'tishni taqiqlagan telefon raqamlari
CREATE TABLE "blocked_phones" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "reason" VARCHAR(500),
    "blocked_by_id" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_phones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blocked_phones_phone_key" ON "blocked_phones"("phone");
