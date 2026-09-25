import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/error-messages';
import { formatMoney } from '@/lib/utils';
import { useAdditionalWork, useAnswerAdditionalWork, useCreateAdditionalWork } from '../hooks/useAdditionalWork';
import type { AdditionalWorkStatus } from '../types';

const STATUS_LABEL: Record<AdditionalWorkStatus, string> = {
  PENDING: 'Kutilmoqda',
  APPROVED: 'Tasdiqlandi',
  REJECTED: 'Rad etildi',
  CANCELLED: 'Bekor qilindi',
  EXPIRED: 'Muddati tugadi',
};

export function AdditionalWorkPanel({
  orderId,
  isMaster,
  canRequest,
}: {
  orderId: string;
  isMaster: boolean;
  canRequest: boolean;
}) {
  const list = useAdditionalWork(orderId);
  const create = useCreateAdditionalWork(orderId);
  const answer = useAnswerAdditionalWork(orderId);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      { reason: reason.trim(), description: description.trim(), amount: Number(amount) },
      {
        onSuccess: () => {
          setReason('');
          setDescription('');
          setAmount('');
        },
      },
    );
  }

  const items = list.data ?? [];

  return (
    <div className="gm-form">
      {list.isError && <Alert tone="danger">{getErrorMessage(list.error)}</Alert>}
      {answer.isError && <Alert tone="danger">{getErrorMessage(answer.error)}</Alert>}
      {items.length === 0 && <p>Qo‘shimcha ish so‘ralmagan.</p>}
      <div className="gm-list">
        {items.map((work) => (
          <div key={work.id} className="gm-card">
            <div className="gm-card__header">
              <h3>{formatMoney(work.amount, work.currency)}</h3>
              <Badge tone="warning">{STATUS_LABEL[work.status]}</Badge>
            </div>
            <p>
              <strong>{work.reason}</strong> — {work.description}
            </p>
            {!isMaster && work.status === 'PENDING' && (
              <div className="gm-action-row">
                <Button size="sm" onClick={() => answer.mutate({ id: work.id, approve: true })}>
                  Tasdiqlash
                </Button>
                <Button size="sm" variant="danger" onClick={() => answer.mutate({ id: work.id, approve: false })}>
                  Rad etish
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      {isMaster && canRequest && (
        <form className="gm-form" onSubmit={handleSubmit}>
          {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}
          <Input label="Sabab" required value={reason} onChange={(event) => setReason(event.target.value)} />
          <Input label="Tavsif" required value={description} onChange={(event) => setDescription(event.target.value)} />
          <Input
            label="Summa (so‘m)"
            type="number"
            min={1}
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <Button type="submit" loading={create.isPending} disabled={!reason || !description || !amount}>
            Qo‘shimcha ish so‘rash
          </Button>
        </form>
      )}
    </div>
  );
}
