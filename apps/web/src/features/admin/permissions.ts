/** Admin huquqlari (bo‘limlar) — backend `ADMIN_PERMISSIONS` bilan bir xil kalitlar. */
export type AdminPermission = 'USERS' | 'ORDERS' | 'CHATS' | 'VERIFICATIONS' | 'CASES' | 'SAFETY' | 'CATALOG' | 'POLICIES' | 'REPORTS' | 'AUDIT' | 'DEVOPS';

export const ADMIN_PERMISSION_OPTIONS: Array<{ value: AdminPermission; label: string; hint: string; group: 'Boshqaruv' | 'Kontent' | 'Tizim' }> = [
  { value: 'REPORTS', label: 'Boshqaruv paneli va hisobotlar', hint: 'Statistika, daromad hisobotlari', group: 'Tizim' },
  { value: 'USERS', label: 'Foydalanuvchilar', hint: 'Mijoz va ustalarni ko‘rish, muzlatish, bloklash, o‘chirish', group: 'Boshqaruv' },
  { value: 'ORDERS', label: 'Buyurtmalar', hint: 'Buyurtmalarni ko‘rish, bekor qilish, nizoni hal qilish', group: 'Boshqaruv' },
  { value: 'CHATS', label: 'Suhbatlar', hint: 'Foydalanuvchilar suhbatlarini kuzatish', group: 'Boshqaruv' },
  { value: 'VERIFICATIONS', label: 'Ustalarni tasdiqlash', hint: 'Hujjat va portfolioni tekshirish', group: 'Boshqaruv' },
  { value: 'CASES', label: 'Shikoyat, nizo va kafolatlar', hint: 'Murojaatlarni ko‘rib chiqish', group: 'Boshqaruv' },
  { value: 'SAFETY', label: 'Choralar va apellyatsiya', hint: 'Cheklovlar, apellyatsiya, kompensatsiya', group: 'Boshqaruv' },
  { value: 'CATALOG', label: 'Xizmatlar katalogi', hint: 'Kategoriya va xizmatlarni tahrirlash', group: 'Kontent' },
  { value: 'POLICIES', label: 'Siyosatlar', hint: 'Shartlar va siyosatlarni boshqarish', group: 'Kontent' },
  { value: 'AUDIT', label: 'Audit jurnali', hint: 'Barcha harakatlar tarixi', group: 'Tizim' },
  { value: 'DEVOPS', label: 'DevOps', hint: 'Tizim holati va ko‘rsatkichlari', group: 'Tizim' },
];

export const PERMISSION_LABEL: Record<string, string> = Object.fromEntries(ADMIN_PERMISSION_OPTIONS.map((option) => [option.value, option.label]));
