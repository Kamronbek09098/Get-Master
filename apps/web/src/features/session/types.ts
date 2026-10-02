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
  masterProfile: { id: string; status: string; verification: string } | null;
}
