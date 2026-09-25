import type { AdminUser } from './types';

export type UserAction = 'SUSPEND' | 'BLOCK' | 'ACTIVATE' | 'DELETE';

interface Copy {
  title: string;
  text: string;
  confirm: string;
  variant: 'primary' | 'danger';
  reasonRequired: boolean;
}

export const USER_ACTION_COPY: Record<UserAction, Copy> = {
  SUSPEND: {
    title: 'Akkauntni muzlatish',
    text: 'Foydalanuvchi darhol tizimdan chiqariladi va qayta kira olmaydi. Usta bo‘lsa, profili mos ustalar qidiruvidan olinadi. Keyinroq qayta faollashtirish mumkin.',
    confirm: 'Muzlatish',
    variant: 'primary',
    reasonRequired: true,
  },
  BLOCK: {
    title: 'Akkauntni bloklash',
    text: 'Foydalanuvchi darhol tizimdan chiqariladi va kira olmaydi. Qoidabuzarlik uchun mo‘ljallangan; keyinroq blokni bekor qilish mumkin.',
    confirm: 'Bloklash',
    variant: 'danger',
    reasonRequired: true,
  },
  ACTIVATE: {
    title: 'Akkauntni faollashtirish',
    text: 'Foydalanuvchi yana tizimga kira oladi. Usta bo‘lsa, profili «Nofaol» holatda tiklanadi — usta uni o‘zi yoqadi.',
    confirm: 'Faollashtirish',
    variant: 'primary',
    reasonRequired: false,
  },
  DELETE: {
    title: 'Akkauntni o‘chirish',
    text: 'Foydalanuvchi tizimga kira olmaydi va ro‘yxatdan yo‘qoladi. Buyurtma va to‘lov tarixi saqlanadi. Bu amalni bekor qilib bo‘lmaydi.',
    confirm: 'O‘chirish',
    variant: 'danger',
    reasonRequired: true,
  },
};

export function displayName(user: AdminUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.phone;
}
