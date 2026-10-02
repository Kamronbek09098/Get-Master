import { t } from '@/i18n';
interface NamedAccount {
  firstName: string | null;
  lastName: string | null;
  accountNumber?: number;
}

export function accountName(user: NamedAccount | null | undefined): string {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  if (name) return name;
  return t('Ism kiritilmagan');
}
