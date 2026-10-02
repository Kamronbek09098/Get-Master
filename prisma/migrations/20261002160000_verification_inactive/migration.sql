-- Yangi hujjat yuborilganda eski (rad etilgan / tuzatish so'ralgan / muddati tugagan) hujjat nofaol bo'ladi
ALTER TYPE "MasterVerificationStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';
