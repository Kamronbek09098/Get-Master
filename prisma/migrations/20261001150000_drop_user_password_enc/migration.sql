-- Parollarning qaytariladigan (shifrlangan) nusxalari butunlay o‘chiriladi: faqat bcrypt xesh qoladi.
ALTER TABLE "users" DROP COLUMN "password_enc";
