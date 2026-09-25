CREATE SEQUENCE "users_account_number_seq" START 571 MINVALUE 571;

ALTER TABLE "users" ADD COLUMN "account_number" INTEGER;

UPDATE "users" SET "account_number" = 570 + numbered.rn
FROM (SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS rn FROM "users") AS numbered
WHERE numbered."id" = "users"."id";

SELECT setval('"users_account_number_seq"', GREATEST(571, 571 + (SELECT COUNT(*) FROM "users")), false);

ALTER TABLE "users" ALTER COLUMN "account_number" SET DEFAULT nextval('"users_account_number_seq"');
ALTER TABLE "users" ALTER COLUMN "account_number" SET NOT NULL;
ALTER SEQUENCE "users_account_number_seq" OWNED BY "users"."account_number";

CREATE UNIQUE INDEX "users_account_number_key" ON "users"("account_number");

CREATE FUNCTION "users_account_number_immutable"() RETURNS trigger AS $$
BEGIN
  IF NEW."account_number" IS DISTINCT FROM OLD."account_number" THEN
    RAISE EXCEPTION 'users.account_number o''zgarmaydi';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "users_account_number_immutable"
BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE FUNCTION "users_account_number_immutable"();
