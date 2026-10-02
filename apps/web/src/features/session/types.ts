import type { Role, UserStatus } from '@/types/common';

export interface Me {
  id: string;
  accountNumber: number;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  status: UserStatus;
  roles: Role[];
  createdAt?: string;
  phoneVerifiedAt?: string | null;
  /** Kirishda OTP so‘ralishi (ikki bosqichli autentifikatsiya). */
  twoFactorEnabled?: boolean;
  /** Superadmin: adminlarni yaratish va boshqarish huquqi. */
  isSuperAdmin?: boolean;
  /** Oddiy adminning ruxsat berilgan bo‘limlari. */
  adminPermissions?: string[];
  masterProfile: { id: string; status: string; verification: string } | null;
}
