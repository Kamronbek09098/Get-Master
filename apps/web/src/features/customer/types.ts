import type { Role, UserStatus } from '@/types/common';

export interface CustomerProfile {
  id: string;
  accountNumber: number;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  status: UserStatus;
  phoneVerified: boolean;
  roles: Role[];
  createdAt: string;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
}

export interface CustomerPreferences {
  language: 'UZ' | 'RU' | 'EN';
  currency: 'UZS' | 'USD';
  notificationsEnabled: boolean;
  /** Afzal ko‘rilgan to‘lov usuli (to‘lov oynasida oldindan tanlanadi). */
  paymentMethod?: 'CASH' | 'CLICK' | 'PAYME' | 'UZUM';
}

export interface Address {
  id: string;
  title: string | null;
  addressLine: string;
  city: string | null;
  district: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  isDefault: boolean;
  createdAt: string;
}

export interface AddressInput {
  title?: string;
  addressLine: string;
  city?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}
