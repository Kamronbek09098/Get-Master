-- Administrator suhbatida foydalanuvchining yozish huquqi: admin belgilaydi (standart: yo‘q).
ALTER TABLE "conversations" ADD COLUMN "user_can_reply" BOOLEAN NOT NULL DEFAULT false;
