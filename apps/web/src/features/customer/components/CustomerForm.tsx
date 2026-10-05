import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { joinFullName, splitFullName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { useUpdateProfile } from '../hooks/useCustomer';
import type { CustomerProfile } from '../types';
import { t } from '@/i18n';

export function CustomerForm({ profile }: { profile: CustomerProfile }) {
  const updateProfile = useUpdateProfile();
  const initial = joinFullName(profile.firstName, profile.lastName);
  const [fullName, setFullName] = useState(initial);
  const parts = splitFullName(fullName);
  const dirty = !!parts && fullName.trim().replace(/\s+/g, ' ') !== initial;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (parts) updateProfile.mutate(parts);
  }

  return (
    <form className="gm-form" onSubmit={handleSubmit}>
      {updateProfile.isError && <Alert tone="danger">{getErrorMessage(updateProfile.error)}</Alert>}
      {updateProfile.isSuccess && <Alert tone="success">{t('Profil muvaffaqiyatli yangilandi')}</Alert>}
      <Input label={t('To‘liq ism')} placeholder={t('Masalan: Kamronbek Ziyovuddinov')} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={200} hint={fullName.trim() && !parts ? t('Ism va familiyani birga yozing') : undefined} />
      <Button type="submit" size="lg" fullWidth className="gm-psave" loading={updateProfile.isPending} disabled={!dirty}>{t('Saqlash')}</Button>
    </form>
  );
}
