ALTER TABLE "conversation_participants" ADD COLUMN "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "conversation_participants" cp
SET "roles" = ARRAY_REMOVE(ARRAY[
  CASE WHEN cp."userId" = o."customerId" THEN 'CUSTOMER' END,
  CASE WHEN cp."userId" = mp."userId" THEN 'MASTER' END
], NULL)
FROM "conversations" c
JOIN "orders" o ON o."id" = c."orderId"
JOIN "master_profiles" mp ON mp."id" = o."masterId"
WHERE cp."conversationId" = c."id";

UPDATE "conversation_participants" cp
SET "roles" = ARRAY['CUSTOMER']
FROM "conversations" c
WHERE cp."conversationId" = c."id" AND c."type" = 'DIRECT'
  AND cp."userId" = (
    SELECT m."senderId" FROM "messages" m WHERE m."conversationId" = c."id" ORDER BY m."createdAt" ASC LIMIT 1
  );

UPDATE "conversation_participants" cp
SET "roles" = ARRAY['MASTER']
FROM "conversations" c
WHERE cp."conversationId" = c."id" AND c."type" = 'DIRECT' AND cardinality(cp."roles") = 0
  AND EXISTS (
    SELECT 1 FROM "conversation_participants" other
    WHERE other."conversationId" = c."id" AND other."userId" <> cp."userId" AND cardinality(other."roles") > 0
  );
