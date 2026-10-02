import { useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate } from '@/lib/utils';
import { useCreateReview } from '../hooks/useReviews';

const RATING_OPTIONS = [
  { value: '5', label: '5 — A’lo' },
  { value: '4', label: '4 — Yaxshi' },
  { value: '3', label: '3 — O‘rtacha' },
  { value: '2', label: '2 — Yomon' },
  { value: '1', label: '1 — Juda yomon' },
];

export function ReviewForm({ orderId, existing }: { orderId: string; existing?: { rating: number; comment: string | null; createdAt: string } | null }) {
  const createReview = useCreateReview();
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createReview.mutate({ orderId, rating: Number(rating), comment: comment.trim() || undefined });
  }

  // Sharh qoldirilgan: forma va tugma ko‘rsatilmaydi, qoldirilgan sharh ko‘rinib turadi (qayta qoldirib bo‘lmaydi).
  const done = existing ?? (createReview.isSuccess ? { rating: Number(rating), comment: comment.trim() || null, createdAt: new Date().toISOString() } : null);
  if (done) {
    return (
      <div className="gm-review-done" role="status">
        <p className="gm-review-done__title">
          <CheckCircle2 size={18} aria-hidden="true" /> Sharhingiz qoldirilgan. Rahmat!
        </p>
        <div className="gm-review-done__body">
          <span className="gm-review-stars" aria-label={`${done.rating} / 5`}>
            {'★'.repeat(done.rating)}
            <span className="gm-review-stars__off">{'★'.repeat(5 - done.rating)}</span>
          </span>
          {done.comment ? <p>{done.comment}</p> : <p className="gm-card__meta">Izoh qoldirilmagan</p>}
          <small>{formatDate(done.createdAt)}</small>
        </div>
        <Button type="button" disabled aria-disabled="true">
          <CheckCircle2 size={16} aria-hidden="true" /> Sharh qoldirilgan
        </Button>
      </div>
    );
  }

  return (
    <form className="gm-form" onSubmit={handleSubmit}>
      {createReview.isError && <Alert tone="danger">{getErrorMessage(createReview.error)}</Alert>}
      <Select label="Baho" options={RATING_OPTIONS} value={rating} onChange={(event) => setRating(event.target.value)} />
      <Textarea label="Izoh" value={comment} onChange={(event) => setComment(event.target.value)} rows={3} />
      <Button type="submit" loading={createReview.isPending}>
        Sharh qoldirish
      </Button>
    </form>
  );
}
