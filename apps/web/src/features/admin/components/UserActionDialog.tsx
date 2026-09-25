import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { useDeleteUser, useSetUserStatus } from '../hooks/useAdmin';
import { USER_ACTION_COPY, displayName } from '../user-actions';
import type { UserAction } from '../user-actions';
import type { AdminUser } from '../types';

export function UserActionDialog({ user, action, onClose }: { user: AdminUser; action: UserAction; onClose: () => void }) {
  const copy = USER_ACTION_COPY[action];
  const setStatus = useSetUserStatus();
  const deleteUser = useDeleteUser();
  const [reason, setReason] = useState('');

  const pending = setStatus.isPending || deleteUser.isPending;
  const error = setStatus.error ?? deleteUser.error;
  const valid = !copy.reasonRequired || reason.trim().length >= 3;

  function confirm() {
    const done = { onSuccess: onClose };
    const trimmed = reason.trim();
    if (action === 'DELETE') deleteUser.mutate({ id: user.id, reason: trimmed }, done);
    else if (action === 'ACTIVATE') setStatus.mutate({ id: user.id, status: 'ACTIVE' }, done);
    else setStatus.mutate({ id: user.id, status: action === 'SUSPEND' ? 'SUSPENDED' : 'BLOCKED', reason: trimmed }, done);
  }

  return (
    <Modal
      open
      onClose={pending ? () => undefined : onClose}
      title={copy.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Bekor qilish
          </Button>
          <Button variant={copy.variant} loading={pending} disabled={!valid} onClick={confirm}>
            {copy.confirm}
          </Button>
        </>
      }
    >
      <div className="gm-form">
        <p>
          <strong>{displayName(user)}</strong> · {user.phone}
        </p>
        <Alert tone={copy.variant === 'danger' ? 'warning' : 'info'}>{copy.text}</Alert>
        {error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
        {copy.reasonRequired && (
          <Textarea
            label="Sabab"
            required
            rows={3}
            maxLength={500}
            hint="Audit jurnaliga yoziladi (kamida 3 ta belgi)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
      </div>
    </Modal>
  );
}
