import { CheckCircle2, Star } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { formatDate, initials } from '@/lib/utils';
import { StarsStatic } from '@/features/review/components/StarRating';
import { useMasterCompletedJobs } from '../hooks/useMaster';
import { t } from '@/i18n';
import './CompletedJobs.css';

const LEVELS = ['5', '4', '3', '2', '1'] as const;

/** Ustaning yakunlangan ishlari natijasi: umumiy baho, baholar taqsimoti va oxirgi ishlar sharhlari bilan. */
export function CompletedJobs({ masterId, completedOrders }: { masterId: string; completedOrders: number }) {
  const jobs = useMasterCompletedJobs(masterId);
  const data = jobs.data;
  if (jobs.isLoading) return null;
  if (!data || (data.items.length === 0 && data.summary.reviews === 0)) {
    return (
      <section className="gm-mp-section">
        <h2>{t('Reyting va sharhlar')}</h2>
        <EmptyState title={t('Hali sharh yo‘q')} description={t('Yakunlangan ishlarga mijozlar qoldirgan sharhlar shu yerda ko‘rinadi.')} />
      </section>
    );
  }
  const { summary, items } = data;
  const max = Math.max(1, ...Object.values(summary.distribution));
  const positive = summary.reviews > 0 ? Math.round(((summary.distribution['5'] + summary.distribution['4']) / summary.reviews) * 100) : null;

  return (
    <section className="gm-mp-section gm-cj" aria-label={t('Reyting va sharhlar')}>
      <h2>{t('Reyting va sharhlar')}</h2>

      <div className="gm-cj__summary">
        <div className="gm-cj__score">
          <strong>{summary.average !== null ? summary.average.toFixed(1) : '—'}</strong>
          {summary.average !== null && <StarsStatic value={summary.average} />}
          <small>{t('({ratingCount} ta sharh)', { ratingCount: summary.reviews })}</small>
        </div>
        <ul className="gm-cj__bars" aria-label={t('Baholar taqsimoti')}>
          {LEVELS.map((level) => (
            <li key={level}>
              <span>
                {level} <Star size={12} fill="currentColor" aria-hidden="true" />
              </span>
              <i>
                <b style={{ width: `${(summary.distribution[level] / max) * 100}%` }} />
              </i>
              <em>{summary.distribution[level]}</em>
            </li>
          ))}
        </ul>
        <dl className="gm-cj__facts">
          <div>
            <dt>{t('Bajarilgan ishlar')}</dt>
            <dd>{completedOrders}</dd>
          </div>
          {positive !== null && (
            <div>
              <dt>{t('Ijobiy baho')}</dt>
              <dd>{positive}%</dd>
            </div>
          )}
        </dl>
      </div>

      <ul className="gm-cj__list">
        {items.map((job) => (
          <li key={job.id} className="gm-cj__job">
            <header>
              <span className="gm-cj__done">
                <i aria-hidden="true">
                  <CheckCircle2 size={16} />
                </i>
                <span>{job.title}</span>
              </span>
              {job.completedAt && <time dateTime={job.completedAt}>{formatDate(job.completedAt)}</time>}
            </header>
            {job.review ? (
              <div className="gm-cj__review">
                <span className="gm-cj__avatar" aria-hidden="true">
                  {initials(job.review.authorName ?? t('Mijoz'))}
                </span>
                <div className="gm-cj__body">
                  <div className="gm-cj__who">
                    <strong>{job.review.authorName ?? t('Mijoz')}</strong>
                    <span className="gm-cj__stars">
                      <StarsStatic value={job.review.rating} />
                      <b>{job.review.rating.toFixed(1)}</b>
                    </span>
                  </div>
                  {job.review.comment && <p>{job.review.comment}</p>}
                </div>
              </div>
            ) : (
              <p className="gm-cj__muted">{t('Hali baholanmagan')}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
