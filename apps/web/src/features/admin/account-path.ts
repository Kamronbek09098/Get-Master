/** Profil manzili raqamli ID bilan: o‘zingizniki — shaxsiy bo‘lim, boshqaniki — foydalanuvchi profili. */
export function accountPath(accountNumber: number, myNumber: number | undefined) {
  return accountNumber === myNumber ? '/sozlamalar' : `/admin/foydalanuvchilar/${accountNumber}`;
}
