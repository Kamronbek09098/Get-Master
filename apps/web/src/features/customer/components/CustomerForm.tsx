import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/error-messages';
import { useUpdateProfile } from '../hooks/useCustomer';
import type { CustomerProfile } from '../types';

export function CustomerForm({ profile }: { profile: CustomerProfile }) {
  const updateProfile = useUpdateProfile();
  const [firstName, setFirstName] = useState(profile.firstName ?? '');
  const [lastName, setLastName] = useState(profile.lastName ?? '');

  const dirty = firstName.trim() !== (profile.firstName ?? '') || lastName.trim() !== (profile.lastName ?? '');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    updateProfile.mutate({ firstName: firstName.trim(), lastName: lastName.trim() });
  }

  return (
    <form className="gm-form" onSubmit={handleSubmit}>
      {updateProfile.isError && <Alert tone="danger">{getErrorMessage(updateProfile.error)}</Alert>}
      {updateProfile.isSuccess && <Alert tone="success">Profil muvaffaqiyatli yangilandi</Alert>}
      <Input label="Ism" value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={100} />
      <Input label="Familiya" value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={100} />
      <Button type="submit" size="lg" fullWidth className="gm-psave" loading={updateProfile.isPending} disabled={!dirty}>
        Saqlash
      </Button>
    </form>
  );
}
