import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useMe } from '@/features/session/hooks/useMe';

/** Profil manzili raqamli ID bilan: o‘zingizniki — shaxsiy bo‘lim, boshqaniki — foydalanuvchi profili. */
export function accountPath(accountNumber: number, myNumber: number | undefined) {
  return accountNumber === myNumber ? '/sozlamalar' : `/admin/foydalanuvchilar/${accountNumber}`;
}

export function AccountLink({ accountNumber, className, children }: { accountNumber: number; className?: string; children: ReactNode }) {
  const me = useMe();
  const own = accountNumber === me.data?.accountNumber;
  return (
    <Link to={accountPath(accountNumber, me.data?.accountNumber)} className={className} title={own ? 'Mening profilim' : 'Profilni ochish'}>
      {children}
    </Link>
  );
}
