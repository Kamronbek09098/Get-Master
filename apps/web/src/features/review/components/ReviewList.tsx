import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate } from '@/lib/utils';
import { useMasterReviews } from '../hooks/useReviews';
import { t } from '@/i18n';

export function ReviewList({ masterId }: { masterId: string }) {
  const reviews = useMasterReviews(masterId);
  const items = reviews.data?.items ?? [];

  if (reviews.isLoading) return <PageLoader label={t('Sharhlar yuklanmoqda…')} />;
  if (reviews.isError) return <Alert tone="danger">{getErrorMessage(reviews.error)}</Alert>;
  if (items.length === 0) return <EmptyState title={t('Hali sharh yo‘q')} />;

  return (
    <div className="gm-list">
      {items.map((review) => (
        <div key={review.id} className="gm-card">
          <div className="gm-card__header">
            <h3 className="gm-review-stars" aria-label={`${review.rating} / 5`}>
              {'★'.repeat(review.rating)}
              <span className="gm-review-stars__off">{'★'.repeat(5 - review.rating)}</span>
            </h3>
            <span className="gm-card__meta">{formatDate(review.createdAt)}</span>
          </div>
          {review.comment ? <p>{review.comment}</p> : <p className="gm-card__meta gm-review-nocomment">{t('Izoh qoldirilmagan')}</p>}
        </div>
      ))}
    </div>
  );
}
