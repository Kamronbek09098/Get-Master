import type { Role } from '@/types/common';
import { t } from '@/i18n';
import { env } from './env';

export const PANEL_LABEL: Record<Role, string> = {
  CUSTOMER: t('Mijoz paneli'),
  MASTER: t('Usta paneli'),
  ADMIN: t('Admin paneli'),
};

export const currentPanelLabel: string | null = env.appRole ? PANEL_LABEL[env.appRole] : null;

export const APP_TITLE = currentPanelLabel ? t('GetMaster — {currentPanelLabel}', { currentPanelLabel }) : 'GetMaster';
