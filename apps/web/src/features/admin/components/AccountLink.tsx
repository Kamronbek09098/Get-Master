import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useMe } from '@/features/session/hooks/useMe';

/** Akkaunt ustiga bosilganda: o‘zingizniki bo‘lsa — shaxsiy bo‘lim, boshqaniki bo‘lsa — o‘sha foydalanuvchi profili. */
export function accountPath(userId: string, myId: string | undefined) {
  return userId === myId ? '/sozlamalar' : `/admin/foydalanuvchilar/${userId}`;
}

export function AccountLink({ userId, className, children }: { userId: string; className?: string; children: ReactNode }) {
  const me = useMe();
  const own = userId === me.data?.id;
  return (
    <Link to={accountPath(userId, me.data?.id)} className={className} title={own ? 'Mening profilim' : 'Profilni ochish'}>
      {children}
    </Link>
  );
}
