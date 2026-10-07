import { useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate } from '@/lib/utils';
import { useCreateReview } from '../hooks/useReviews';
import { StarRating, StarsStatic } from './StarRating';
import { t } from '@/i18n';

export function ReviewForm({ orderId, existing }: { orderId: string; existing?: { rating: number; comment: string | null; createdAt: string } | null }) {
  const createReview = useCreateReview();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createReview.mutate({ orderId, rating, comment: comment.trim() || undefined });
  }

  // Sharh qoldirilgan: forma va tugma ko‘rsatilmaydi, qoldirilgan sharh ko‘rinib turadi (qayta qoldirib bo‘lmaydi).
  const done = existing ?? (createReview.isSuccess ? { rating, comment: comment.trim() || null, createdAt: new Date().toISOString() } : null);
  if (done) {
    return (
      <div className="gm-review-done" role="status">
        <p className="gm-review-done__title">
          <CheckCircle2 size={18} aria-hidden="true" />{' '}{t('Sharhingiz qoldirilgan. Rahmat!')}</p>
        <div className="gm-review-done__body">
          <StarsStatic value={done.rating} />
          {done.comment ? <p>{done.comment}</p> : <p className="gm-card__meta">{t('Izoh qoldirilmagan')}</p>}
          <small>{formatDate(done.createdAt)}</small>
        </div>
      </div>
    );
  }

  return (
    <form className="gm-form" onSubmit={handleSubmit}>
      {createReview.isError && <Alert tone="danger">{getErrorMessage(createReview.error)}</Alert>}
      <StarRating label={t('Ish sifatini baholang')} value={rating} onChange={setRating} />
      <Textarea label={t('Izoh (ixtiyoriy)')} value={comment} onChange={(event) => setComment(event.target.value)} rows={3} placeholder={t('Nima yoqdi yoki nimani yaxshilash mumkin?')} />
      <Button type="submit" loading={createReview.isPending} disabled={rating === 0}>{t('Sharh qoldirish')}</Button>
    </form>
  );
}
