import { t } from '@/i18n';
/** Admin huquqlari (bo‘limlar) — backend `ADMIN_PERMISSIONS` bilan bir xil kalitlar. */
export type AdminPermission = 'USERS' | 'ORDERS' | 'CHATS' | 'VERIFICATIONS' | 'CASES' | 'SAFETY' | 'CATALOG' | 'POLICIES' | 'REPORTS' | 'AUDIT' | 'DEVOPS';

export const ADMIN_PERMISSION_OPTIONS: Array<{ value: AdminPermission; label: string; hint: string; group: 'Boshqaruv' | 'Kontent' | 'Tizim' }> = [
  { value: 'REPORTS', label: t('Boshqaruv paneli va hisobotlar'), hint: t('Statistika, daromad hisobotlari'), group: 'Tizim' },
  { value: 'USERS', label: t('Foydalanuvchilar'), hint: t('Mijoz va ustalarni ko‘rish, muzlatish, bloklash, o‘chirish'), group: 'Boshqaruv' },
  { value: 'ORDERS', label: t('Buyurtmalar'), hint: t('Buyurtmalarni ko‘rish, bekor qilish, nizoni hal qilish'), group: 'Boshqaruv' },
  { value: 'CHATS', label: t('Suhbatlar'), hint: t('Foydalanuvchilar suhbatlarini kuzatish'), group: 'Boshqaruv' },
  { value: 'VERIFICATIONS', label: t('Ustalarni tasdiqlash'), hint: t('Hujjat va portfolioni tekshirish'), group: 'Boshqaruv' },
  { value: 'CASES', label: t('Shikoyat, nizo va kafolatlar'), hint: t('Murojaatlarni ko‘rib chiqish'), group: 'Boshqaruv' },
  { value: 'SAFETY', label: t('Choralar va apellyatsiya'), hint: t('Cheklovlar, apellyatsiya, kompensatsiya'), group: 'Boshqaruv' },
  { value: 'CATALOG', label: t('Xizmatlar katalogi'), hint: t('Kategoriya va xizmatlarni tahrirlash'), group: 'Kontent' },
  { value: 'POLICIES', label: t('Siyosatlar'), hint: t('Shartlar va siyosatlarni boshqarish'), group: 'Kontent' },
  { value: 'AUDIT', label: t('Audit jurnali'), hint: t('Barcha harakatlar tarixi'), group: 'Tizim' },
  { value: 'DEVOPS', label: 'DevOps', hint: t('Tizim holati va ko‘rsatkichlari'), group: 'Tizim' },
];

export const PERMISSION_LABEL: Record<string, string> = Object.fromEntries(ADMIN_PERMISSION_OPTIONS.map((option) => [option.value, option.label]));
