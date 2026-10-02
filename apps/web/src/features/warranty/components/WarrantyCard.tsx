import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate } from '@/lib/utils';
import { useCreateWarrantyClaim } from '../hooks/useWarranties';
import type { Warranty } from '../types';
import { t } from '@/i18n';

export function WarrantyCard({ warranty, canClaim }: { warranty: Warranty; canClaim: boolean }) {
  const createClaim = useCreateWarrantyClaim(warranty.id);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const isActive = warranty.status === 'ACTIVE' && new Date(warranty.expiresAt) > new Date();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createClaim.mutate({ reason: reason.trim(), description: description.trim() });
  }

  return (
    <div className="gm-card">
      <div className="gm-card__header">
        <h3>{t('Kafolat: {date} gacha', { date: formatDate(warranty.expiresAt) })}</h3>
        <Badge tone={isActive ? 'success' : 'neutral'}>{isActive ? t('Faol') : t('Tugagan')}</Badge>
      </div>
      {warranty.conditions && <p>{warranty.conditions}</p>}
      {canClaim && isActive && !createClaim.isSuccess && (
        <form className="gm-form" onSubmit={handleSubmit}>
          {createClaim.isError && <Alert tone="danger">{getErrorMessage(createClaim.error)}</Alert>}
          <Input label={t('Sabab')} required value={reason} onChange={(event) => setReason(event.target.value)} />
          <Input label={t('Tavsif')} required value={description} onChange={(event) => setDescription(event.target.value)} />
          <Button type="submit" size="sm" loading={createClaim.isPending} disabled={!reason || !description}>{t('Kafolat bo‘yicha murojaat')}</Button>
        </form>
      )}
      {createClaim.isSuccess && <Alert tone="success">{t('Murojaatingiz qabul qilindi')}</Alert>}
    </div>
  );
}
