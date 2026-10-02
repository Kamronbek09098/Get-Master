import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { getErrorMessage } from '@/lib/error-messages';
import { useMe } from '../hooks/useMe';
import { sessionService } from '../services/session.service';
import { t } from '@/i18n';

const noop = () => undefined;

/** Ism yoki familiya kiritilmagan mijoz/usta akkauntlari davom etishdan oldin ularni kiritishi shart. */
export function NameRequiredDialog() {
  const me = useMe();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const save = useMutation({
    mutationFn: () => sessionService.updateName({ firstName: firstName.trim(), lastName: lastName.trim() }),
    onSuccess: (updated) => queryClient.setQueryData(['users', 'me'], updated),
  });

  const user = me.data;
  const needsName = !!user && !user.roles.includes('ADMIN') && (!user.firstName?.trim() || !user.lastName?.trim());
  if (!needsName) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <Modal
      open
      dismissible={false}
      onClose={noop}
      title={t('Ism va familiyangizni kiriting')}
      footer={
        <Button type="submit" form="gm-name-form" loading={save.isPending} disabled={!firstName.trim() || !lastName.trim()}>
          {t('Saqlash')}
        </Button>
      }
    >
      <form id="gm-name-form" className="gm-form" onSubmit={handleSubmit}>
        <p style={{ margin: 0, color: 'var(--gm-color-text-muted)' }}>
          {t('Boshqa foydalanuvchilar sizni ism va familiyangiz bilan ko‘radi. Davom etish uchun ularni kiriting.')}
        </p>
        {save.isError && <Alert tone="danger">{getErrorMessage(save.error)}</Alert>}
        <Input label={t('Ism')} required maxLength={100} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        <Input label={t('Familiya')} required maxLength={100} value={lastName} onChange={(event) => setLastName(event.target.value)} />
      </form>
    </Modal>
  );
}
