-- Ikki bosqichli autentifikatsiya (kirishda OTP): foydalanuvchi yoqib/o'chira oladi. Odatiy — yoqilgan (avvalgi xatti-harakat).
ALTER TABLE "users" ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT true;
