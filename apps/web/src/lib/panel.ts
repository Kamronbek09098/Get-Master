import type { Role } from '@/types/common';
import { env } from './env';

export const PANEL_LABEL: Record<Role, string> = {
  CUSTOMER: 'Mijoz paneli',
  MASTER: 'Usta paneli',
  ADMIN: 'Admin paneli',
};

export const currentPanelLabel: string | null = env.appRole ? PANEL_LABEL[env.appRole] : null;

export const APP_TITLE = currentPanelLabel ? `GetMaster — ${currentPanelLabel}` : 'GetMaster';
