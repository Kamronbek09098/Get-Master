-- Bir juftlik (mijoz + usta) uchun faqat BITTA suhbat: mavjud takroriy suhbatlar birlashtiriladi.
CREATE TEMP TABLE _conv_dup ON COMMIT DROP AS
WITH pairs AS (
  SELECT c.id, c."orderId", c."updatedAt",
         (SELECT string_agg(p."userId"::text, ':' ORDER BY p."userId"::text) FROM conversation_participants p WHERE p."conversationId" = c.id) AS pair,
         (SELECT count(*) FROM conversation_participants p WHERE p."conversationId" = c.id) AS n
  FROM conversations c
  WHERE c.type <> 'SUPPORT'
), ranked AS (
  SELECT id, pair,
         ROW_NUMBER() OVER w AS rn,
         FIRST_VALUE(id) OVER w AS keeper
  FROM pairs
  WHERE n = 2
  WINDOW w AS (PARTITION BY pair ORDER BY ("orderId" IS NOT NULL) DESC, "updatedAt" DESC, id)
)
SELECT id, keeper FROM ranked WHERE rn > 1;

UPDATE messages m SET "conversationId" = d.keeper FROM _conv_dup d WHERE m."conversationId" = d.id;
UPDATE calls c SET "conversationId" = d.keeper FROM _conv_dup d WHERE c."conversationId" = d.id;
UPDATE media_assets a SET linked_resource_id = d.keeper FROM _conv_dup d WHERE a.linked_resource_type = 'Conversation' AND a.linked_resource_id = d.id;
UPDATE conversation_participants p SET deleted_at = NULL WHERE p."conversationId" IN (SELECT DISTINCT keeper FROM _conv_dup);
UPDATE conversations c SET "updatedAt" = GREATEST(c."updatedAt", x.latest)
  FROM (SELECT d.keeper, max(o."updatedAt") AS latest FROM _conv_dup d JOIN conversations o ON o.id = d.id GROUP BY d.keeper) x
  WHERE c.id = x.keeper;
DELETE FROM conversations WHERE id IN (SELECT id FROM _conv_dup);

-- Har bir buyurtma/to'g'ridan-to'g'ri suhbat uchun juftlik kaliti (keyingi takrorlanishni bazaning o'zi to'xtatadi: direct_key UNIQUE).
UPDATE conversations c SET direct_key = s.pair
FROM (
  SELECT c2.id, string_agg(p."userId"::text, ':' ORDER BY p."userId"::text) AS pair, count(*) AS n
  FROM conversations c2 JOIN conversation_participants p ON p."conversationId" = c2.id
  WHERE c2.type <> 'SUPPORT' AND c2.direct_key IS NULL
  GROUP BY c2.id
) s
WHERE c.id = s.id AND s.n = 2;
