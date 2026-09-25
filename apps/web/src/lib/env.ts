import type { Role } from '@/types/common';

const ROLES: readonly Role[] = ['CUSTOMER', 'MASTER', 'ADMIN'];
const configuredRole = import.meta.env.VITE_APP_ROLE as string | undefined;

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1',
  appRole: ROLES.find((role) => role === configuredRole) ?? null,
} as const;
