import { cx, formatMinutes, groupDigits } from '@/lib/utils';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { useCreateOffer } from '../hooks/useOffers';
import { t } from '@/i18n';
import './OfferForm.css';

const MIN_MINUTES = 5;
const MAX_MINUTES = 10080;
const QUICK_MINUTES = [30, 60, 120, 180, 240];

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

  const minutesValue = Number(minutes) || 0;
  const minutesInvalid = minutesValue > 0 && minutesValue < MIN_MINUTES;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (minutesInvalid) return;
    create.mutate(
      {
        requestId,
        price: Number(price),
        estimatedMinutes: minutesValue || undefined,
        message: message.trim() || undefined,
      },
      { onSuccess: () => onDone?.() },
    );
  }

  return (
    <form className="gm-form gm-offer-form" onSubmit={handleSubmit}>
      {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}
      <MoneyInput label={t('Narx (so‘m)')} required value={price} onValueChange={setPrice} />
      <div className="gm-offer-form__duration">
        <Input
          label={t('Taxminiy davomiylik (daqiqa, ixtiyoriy)')}
          type="text"
          inputMode="numeric"
          placeholder="60"
          suffix={t('daq')}
          value={groupDigits(minutes)}
          formatValue={groupDigits}
          error={minutesInvalid ? t('Kamida {n} daqiqa bo‘lishi kerak', { n: MIN_MINUTES }) : undefined}
          hint={minutesValue >= MIN_MINUTES ? `≈ ${formatMinutes(minutesValue)}` : undefined}
          onChange={(e) => setMinutes(String(Math.min(Number(e.target.value.replace(/\D/g, '')) || 0, MAX_MINUTES) || ''))}
        />
        <div className="gm-offer-form__chips" role="group" aria-label={t('Tezkor tanlash')}>
          {QUICK_MINUTES.map((value) => (
            <button
              key={value}
              type="button"
              className={cx('gm-offer-form__chip', minutesValue === value && 'is-active')}
              aria-pressed={minutesValue === value}
              onClick={() => setMinutes(String(value))}
            >
              {formatMinutes(value)}
            </button>
          ))}
        </div>
      </div>
      <Textarea label={t('Xabar (ixtiyoriy)')} rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
      <Button type="submit" size="lg" fullWidth loading={create.isPending} disabled={!price || minutesInvalid}>
        {submitLabel}
      </Button>
    </form>
  );
}
