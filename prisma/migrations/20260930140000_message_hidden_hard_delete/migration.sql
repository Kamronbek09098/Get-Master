-- «Men uchun o'chirish» jadvali
CREATE TABLE "message_hidden" (
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_hidden_pkey" PRIMARY KEY ("message_id","user_id")
);

CREATE INDEX "message_hidden_user_id_idx" ON "message_hidden"("user_id");

ALTER TABLE "message_hidden" ADD CONSTRAINT "message_hidden_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_hidden" ADD CONSTRAINT "message_hidden_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Avval «o'chirilgan» deb belgilangan xabarlar endi chatda umuman ko'rinmasligi kerak: butunlay o'chiramiz.
DELETE FROM "media_assets"
WHERE "id" IN (
  SELECT (a->>'mediaAssetId')::uuid
  FROM "messages" m, jsonb_array_elements(COALESCE(m."attachments", '[]'::jsonb)) a
  WHERE m."deleted_at" IS NOT NULL AND a->>'mediaAssetId' IS NOT NULL
);

DELETE FROM "messages" WHERE "deleted_at" IS NOT NULL;
