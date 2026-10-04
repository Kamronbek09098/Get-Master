import type { Role } from '@/types/common';

const ROLES: readonly Role[] = ['CUSTOMER', 'MASTER', 'ADMIN'];
const configuredRole = import.meta.env.VITE_APP_ROLE as string | undefined;

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1',
  /** Google profilidan telefonni ham so‘rash (Google Cloud'da People API va user.phonenumbers.read ruxsati sozlangan bo‘lsa). */
  googlePhone: import.meta.env.VITE_GOOGLE_PHONE === '1',
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '',
  appRole: ROLES.find((role) => role === configuredRole) ?? null,
} as const;
