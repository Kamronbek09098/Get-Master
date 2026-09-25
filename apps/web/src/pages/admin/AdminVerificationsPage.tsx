import { accountName } from '@/lib/account-name';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/utils';
import { MediaViewer } from '@/features/media/components/MediaViewer';
import { TrustBadge } from '@/features/trust/components/TrustBadge';
import { useAdminPortfolio, useAdminVerifications, useReviewPortfolio, useReviewVerification } from '@/features/admin/hooks/useAdmin';
import type { AdminPortfolioItem, AdminVerification, VerificationDecision } from '@/features/admin/types';

function VerificationCard({ item }: { item: AdminVerification }) {
  const review = useReviewVerification();
  const [reason, setReason] = useState('');
  const name = accountName(item.master.user);

  function act(decision: VerificationDecision) {
    review.mutate({ id: item.id, decision, reason: reason.trim() || undefined });
  }

  const needsReason = reason.trim().length < 3;

  return (
    <div className="gm-card">
      <div className="gm-card__header">
        <h3>
          {name} — {item.master.profession ?? 'kasb ko‘rsatilmagan'}
        </h3>
        <TrustBadge verification={item.status} />
      </div>
      <p className="gm-card__meta">
        Hujjat: {item.documentType} · Yuborildi: {formatDateTime(item.createdAt)}
      </p>
      {item.mediaAssetId && <MediaViewer assetId={item.mediaAssetId} alt="Hujjat" label={`Hujjat: ${item.documentType}`} />}
      {item.rejectionReason && <p>Oldingi sabab: {item.rejectionReason}</p>}
      {review.isError && <Alert tone="danger">{getErrorMessage(review.error)}</Alert>}
      <Input label="Sabab (rad etish / tuzatish uchun majburiy)" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
      <div className="gm-action-row" style={{ marginTop: 'var(--gm-space-2)' }}>
        {item.status === 'PENDING' && (
          <Button size="sm" variant="secondary" loading={review.isPending} onClick={() => act('START_REVIEW')}>
            Ko‘rib chiqishni boshlash
          </Button>
        )}
        <Button size="sm" loading={review.isPending} onClick={() => act('APPROVE')}>
          Tasdiqlash
        </Button>
        <Button size="sm" variant="secondary" disabled={needsReason} loading={review.isPending} onClick={() => act('REQUEST_CORRECTION')}>
          Tuzatish so‘rash
        </Button>
        <Button size="sm" variant="danger" disabled={needsReason} loading={review.isPending} onClick={() => act('REJECT')}>
          Rad etish
        </Button>
      </div>
    </div>
  );
}

function PortfolioCard({ item }: { item: AdminPortfolioItem }) {
  const review = useReviewPortfolio();
  const [reason, setReason] = useState('');
  const name = accountName(item.master.user);
  const needsReason = reason.trim().length < 3;

  return (
    <div className="gm-card">
      <div className="gm-card__header">
        <h3>{item.title ?? 'Nomsiz ish namunasi'}</h3>
      </div>
      <p className="gm-card__meta">
        {name}
        {item.master.user.accountNumber !== undefined && ` · ID ${item.master.user.accountNumber}`} · {item.master.profession ?? 'kasb ko‘rsatilmagan'} · Yuborildi:{' '}
        {formatDateTime(item.createdAt)}
      </p>
      {item.mediaAssetId && <MediaViewer assetId={item.mediaAssetId} alt={item.title ?? 'Portfolio'} label={item.title ?? 'Portfolio ishi'} />}
      {review.isError && <Alert tone="danger">{getErrorMessage(review.error)}</Alert>}
      <Input label="Rad etish sababi (rad etish uchun majburiy)" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
      <div className="gm-action-row" style={{ marginTop: 'var(--gm-space-2)' }}>
        <Button size="sm" loading={review.isPending} onClick={() => review.mutate({ id: item.id, decision: 'APPROVE' })}>
          Tasdiqlash
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={needsReason}
          loading={review.isPending}
          onClick={() => review.mutate({ id: item.id, decision: 'REJECT', reason: reason.trim() })}
        >
          Rad etish
        </Button>
      </div>
    </div>
  );
}

function PortfolioSection() {
  const portfolio = useAdminPortfolio();
  const items = portfolio.data?.items ?? [];

  return (
    <section style={{ marginTop: 'var(--gm-space-8)' }}>
      <div className="gm-page-header">
        <h2>Portfolio ishlari{items.length > 0 ? ` (${items.length})` : ''}</h2>
      </div>
      {portfolio.isLoading && <PageLoader />}
      {portfolio.isError && <Alert tone="danger">{getErrorMessage(portfolio.error)}</Alert>}
      {portfolio.data && items.length === 0 && <EmptyState title="Ko‘rib chiqiladigan portfolio ishlari yo‘q" />}
      <div className="gm-list">
        {items.map((item) => (
          <PortfolioCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export function AdminVerificationsPage() {
  const verifications = useAdminVerifications();
  const items = verifications.data?.items ?? [];

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>Ustalarni tasdiqlash</h1>
          <p className="gm-page-lead">Hujjatlar va portfolio ishlarini ko‘rib chiqing.</p>
        </div>
      </div>
      {verifications.isLoading && <PageLoader />}
      {verifications.isError && <Alert tone="danger">{getErrorMessage(verifications.error)}</Alert>}
      {verifications.data && items.length === 0 && <EmptyState title="Ko‘rib chiqiladigan hujjatlar yo‘q" />}
      <div className="gm-list">
        {items.map((item) => (
          <VerificationCard key={`${item.id}-${item.status}`} item={item} />
        ))}
      </div>
      <PortfolioSection />
    </div>
  );
}
