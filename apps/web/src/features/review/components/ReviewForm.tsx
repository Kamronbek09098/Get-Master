import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { useCreateReview } from '../hooks/useReviews';

const RATING_OPTIONS = [
  { value: '5', label: '5 — A’lo' },
  { value: '4', label: '4 — Yaxshi' },
  { value: '3', label: '3 — O‘rtacha' },
  { value: '2', label: '2 — Yomon' },
  { value: '1', label: '1 — Juda yomon' },
];

export function ReviewForm({ orderId }: { orderId: string }) {
  const createReview = useCreateReview();
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createReview.mutate({ orderId, rating: Number(rating), comment: comment.trim() || undefined });
  }

  if (createReview.isSuccess) {
    return <Alert tone="success">Sharhingiz uchun rahmat!</Alert>;
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
