import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { useCreateOffer } from '../hooks/useOffers';
import { t } from '@/i18n';

export function OfferForm({
  requestId,
  onDone,
  initialPrice,
  initialMinutes,
  submitLabel = t('Taklif yuborish'),
}: {
  requestId: string;
  onDone?: () => void;
  initialPrice?: number | null;
  initialMinutes?: number | null;
  submitLabel?: string;
}) {
  const create = useCreateOffer();
  const [price, setPrice] = useState(initialPrice ? String(Math.round(initialPrice)) : '');
  const [minutes, setMinutes] = useState(initialMinutes ? String(initialMinutes) : '');
  const [message, setMessage] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      {
        requestId,
        price: Number(price),
        estimatedMinutes: minutes ? Number(minutes) : undefined,
        message: message.trim() || undefined,
      },
      { onSuccess: () => onDone?.() },
    );
  }

  return (
    <form className="gm-form" onSubmit={handleSubmit}>
      {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}
      <Input label={t('Narx (so‘m)')} type="number" required min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
      <Input
        label={t('Taxminiy davomiylik (daqiqa, ixtiyoriy)')}
        type="number"
        min={5}
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
      />
      <Textarea label={t('Xabar (ixtiyoriy)')} rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
      <div>
        <Button type="submit" loading={create.isPending} disabled={!price}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
