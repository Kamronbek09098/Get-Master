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

export interface ProfileOverview {
  totals: { requests: number; orders: number; masters: number };
  address: { city: string | null; district: string | null; addressLine: string } | null;
  period: {
    days: number;
    requests: { value: number; previous: number };
    orders: { value: number; previous: number };
    cancelled: { value: number; previous: number };
    refunded: { value: number; previous: number };
  };
}
