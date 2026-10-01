import { accountName } from '@/lib/account-name';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/utils';
import { MediaViewer } from '@/features/media/components/MediaViewer';
import { TrustBadge } from '@/features/trust/components/TrustBadge';
import {
  useAdminPortfolio,
  useAdminPortfolioHistory,
  useAdminVerificationHistory,
  useAdminVerifications,
  useReviewPortfolio,
  useReviewVerification,
} from '@/features/admin/hooks/useAdmin';
import './AdminVerificationsPage.css';
import type { AdminActor, AdminPortfolioItem, AdminVerification, VerificationDecision } from '@/features/admin/types';

const ACTION_TEXT: Record<string, string> = {
  VERIFICATION_SUBMITTED: 'Hujjat yuborildi',
  VERIFICATION_START_REVIEW: 'Ko‘rib chiqish boshlandi',
  VERIFICATION_APPROVE: 'Tasdiqlandi',
  VERIFICATION_REJECT: 'Rad etildi',
  VERIFICATION_REQUEST_CORRECTION: 'Tuzatish so‘raldi',
  VERIFICATION_DELETED: 'Hujjat o‘chirildi',
};

const actorName = (actor?: AdminActor | null) => (actor ? [actor.firstName, actor.lastName].filter(Boolean).join(' ') || `ID ${actor.accountNumber}` : 'Tizim');

/** Hujjat bo‘yicha qilingan barcha amallar: kim, qachon, nima qildi. Hech qachon yo‘qolmaydi. */
function ActionLog({ actions }: { actions?: AdminVerification['actions'] }) {
  if (!actions || actions.length === 0) return null;
  return (
    <ol className="gm-actionlog" aria-label="Amallar tarixi">
      {actions.map((entry, index) => (
        <li key={`${entry.createdAt}-${index}`}>
          <strong>{ACTION_TEXT[entry.action] ?? entry.action}</strong>
          <span>
            {actorName(entry.actor)} · {formatDateTime(entry.createdAt)}
          </span>
          {entry.reason && <em>Sabab: {entry.reason}</em>}
        </li>
      ))}
    </ol>
  );
}

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
      <ActionLog actions={item.actions} />
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

const DOCUMENT_LABEL: Record<string, string> = {
  IDENTITY: 'Shaxsni tasdiqlovchi hujjat',
  CERTIFICATE: 'Sertifikat',
  LICENSE: 'Litsenziya',
  OTHER: 'Boshqa',
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="gm-vfact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function VerificationHistoryCard({ item }: { item: AdminVerification }) {
  const [open, setOpen] = useState(false);
  const name = accountName(item.master.user);
  return (
    <>
      <div
        className="gm-card gm-vhist"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <div className="gm-card__header">
          <h3>
            {name} — {item.master.profession ?? 'kasb ko‘rsatilmagan'}
          </h3>
          <TrustBadge verification={item.status} />
        </div>
        <p className="gm-card__meta">
          {DOCUMENT_LABEL[item.documentType] ?? item.documentType} · Yuborildi: {formatDateTime(item.createdAt)}
          {item.reviewedAt && ` · Ko‘rib chiqdi: ${actorName(item.reviewedBy)}, ${formatDateTime(item.reviewedAt)}`}
        </p>
        {item.rejectionReason && <p>Sabab: {item.rejectionReason}</p>}
        <span className="gm-vhist__more">
          Batafsil <ChevronRight size={15} aria-hidden="true" />
        </span>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Hujjat haqida to‘liq ma’lumot" wide footer={<Button onClick={() => setOpen(false)}>Yopish</Button>}>
        <dl className="gm-vfacts">
          <Fact label="Usta">
            {name}
            {item.master.user.accountNumber !== undefined && ` · ID ${item.master.user.accountNumber}`}
          </Fact>
          <Fact label="Kasbi">{item.master.profession ?? 'ko‘rsatilmagan'}</Fact>
          <Fact label="Hujjat turi">{DOCUMENT_LABEL[item.documentType] ?? item.documentType}</Fact>
          <Fact label="Holati">
            <TrustBadge verification={item.status} />
          </Fact>
          <Fact label="Yuborilgan">{formatDateTime(item.createdAt)}</Fact>
          {item.reviewedAt && (
            <Fact label="Ko‘rib chiqqan">
              {actorName(item.reviewedBy)} · {formatDateTime(item.reviewedAt)}
            </Fact>
          )}
          {item.rejectionReason && <Fact label="Sabab">{item.rejectionReason}</Fact>}
        </dl>
        {item.mediaAssetId ? <MediaViewer assetId={item.mediaAssetId} alt="Hujjat" label={`Hujjat: ${DOCUMENT_LABEL[item.documentType] ?? item.documentType}`} /> : <p className="gm-card__meta">Hujjat fayli mavjud emas.</p>}
        <h4 className="gm-vfacts__title">Amallar tarixi</h4>
        <ActionLog actions={item.actions} />
      </Modal>
    </>
  );
}

function PortfolioHistoryCard({ item }: { item: AdminPortfolioItem }) {
  const [open, setOpen] = useState(false);
  const approved = item.status === 'APPROVED';
  const name = accountName(item.master.user);
  return (
    <>
      <div
        className="gm-card gm-vhist"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <div className="gm-card__header">
          <h3>{item.title ?? 'Nomsiz ish namunasi'}</h3>
          <span className={approved ? 'gm-badge gm-badge--success' : 'gm-badge gm-badge--danger'}>{approved ? 'Tasdiqlangan' : 'Rad etilgan'}</span>
        </div>
        <p className="gm-card__meta">
          {name} · {item.master.profession ?? 'kasb ko‘rsatilmagan'} · Yuborildi: {formatDateTime(item.createdAt)}
          {item.reviewedAt && ` · Ko‘rib chiqdi: ${actorName(item.reviewedBy)}, ${formatDateTime(item.reviewedAt)}`}
        </p>
        {item.rejectReason && <p>Sabab: {item.rejectReason}</p>}
        <span className="gm-vhist__more">
          Batafsil <ChevronRight size={15} aria-hidden="true" />
        </span>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Portfolio ishi haqida to‘liq ma’lumot" wide footer={<Button onClick={() => setOpen(false)}>Yopish</Button>}>
        <dl className="gm-vfacts">
          <Fact label="Nomi">{item.title ?? 'Nomsiz ish namunasi'}</Fact>
          {item.description && <Fact label="Tavsif">{item.description}</Fact>}
          <Fact label="Usta">
            {name}
            {item.master.user.accountNumber !== undefined && ` · ID ${item.master.user.accountNumber}`}
          </Fact>
          <Fact label="Kasbi">{item.master.profession ?? 'ko‘rsatilmagan'}</Fact>
          <Fact label="Holati">{approved ? 'Tasdiqlangan' : 'Rad etilgan'}</Fact>
          <Fact label="Yuborilgan">{formatDateTime(item.createdAt)}</Fact>
          {item.reviewedAt && (
            <Fact label="Ko‘rib chiqqan">
              {actorName(item.reviewedBy)} · {formatDateTime(item.reviewedAt)}
            </Fact>
          )}
          {item.rejectReason && <Fact label="Sabab">{item.rejectReason}</Fact>}
        </dl>
        {item.mediaAssetId && <MediaViewer assetId={item.mediaAssetId} alt={item.title ?? 'Portfolio'} label={item.title ?? 'Portfolio ishi'} />}
      </Modal>
    </>
  );
}

function HistorySection() {
  const verifications = useAdminVerificationHistory();
  const portfolio = useAdminPortfolioHistory();
  const verificationItems = verifications.data?.items ?? [];
  const portfolioItems = portfolio.data?.items ?? [];

  return (
    <section style={{ marginTop: 'var(--gm-space-8)' }}>
      <div className="gm-page-header">
        <h2>Ko‘rib chiqilganlar tarixi{verificationItems.length + portfolioItems.length > 0 ? ` (${verificationItems.length + portfolioItems.length})` : ''}</h2>
      </div>
      {(verifications.isLoading || portfolio.isLoading) && <PageLoader />}
      {verifications.data && portfolio.data && verificationItems.length + portfolioItems.length === 0 && <EmptyState title="Hali ko‘rib chiqilgan hujjat yoki ish yo‘q" />}
      <div className="gm-list">
        {verificationItems.map((item) => (
          <VerificationHistoryCard key={item.id} item={item} />
        ))}
        {portfolioItems.map((item) => (
          <PortfolioHistoryCard key={item.id} item={item} />
        ))}
      </div>
    </section>
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
      <HistorySection />
    </div>
  );
}
