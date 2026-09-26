import { accountName } from '@/lib/account-name';
import { useAdminUser } from '../hooks/useAdmin';
import { AccountLink } from './AccountLink';

/** Ichki UUID o‘rniga foydalanuvchining ismi va raqamli ID sini ko‘rsatadi (bosilsa profili ochiladi). */
export function UserRef({ id }: { id: string | null | undefined }) {
  const user = useAdminUser(id ?? undefined);
  if (!id) return <span>—</span>;
  if (!user.data) return <span>{user.isError ? 'Noma’lum foydalanuvchi' : '…'}</span>;
  return (
    <AccountLink accountNumber={user.data.accountNumber} className="gm-userref">
      {accountName(user.data)} · ID {user.data.accountNumber}
    </AccountLink>
  );
}
