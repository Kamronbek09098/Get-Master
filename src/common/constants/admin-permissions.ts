/** Admin huquqlari (bo‘limlar). Superadmin barchasiga ega; oddiy adminga superadmin tanlab beradi. */
export const ADMIN_PERMISSIONS = [
  'USERS', // Mijoz va ustalarni boshqarish
  'ORDERS', // Buyurtmalar
  'CHATS', // Suhbatlar (kuzatuv)
  'VERIFICATIONS', // Ustalarni tasdiqlash va portfolio
  'CASES', // Shikoyat, nizo va kafolatlar
  'SAFETY', // Choralar va apellyatsiya
  'CATALOG', // Xizmatlar katalogi
  'POLICIES', // Siyosatlar
  'REPORTS', // Boshqaruv paneli va hisobotlar
  'AUDIT', // Audit jurnali
  'DEVOPS', // DevOps
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];
