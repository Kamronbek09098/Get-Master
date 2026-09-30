import { Link, useSearchParams } from 'react-router-dom';
import { UserRef } from '@/features/admin/components/UserRef';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/utils';
import { useAdminCases, useUpdateCase } from '@/features/admin/hooks/useAdmin';
import { CASE_STATUS_LABEL } from '@/features/dispute/types';
import type { CaseItem, CaseStatus } from '@/features/dispute/types';

const STATUS_OPTIONS = (Object.keys(CASE_STATUS_LABEL) as CaseStatus[]).map((value) => ({
  value,
  label: CASE_STATUS_LABEL[value],
}));

/** Backend qoidasi bilan bir xil: faqat shu holatlarga o‘tish mumkin. */
const NEXT_STATUSES: Record<CaseStatus, CaseStatus[]> = {
  REPORTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['CONFIRMED', 'DISMISSED'],
  CONFIRMED: ['RESOLVED'],
  DISMISSED: [],
  RESOLVED: [],
};

function CaseCard({ item, kind }: { item: CaseItem; kind: 'complaints' | 'disputes' }) {
  const update = useUpdateCase(kind);
  const [status, setStatus] = useState<CaseStatus>(item.status);
  const [decision, setDecision] = useState(item.decision ?? '');
  const next = NEXT_STATUSES[item.status];
  const finished = next.length === 0;
  const options = [item.status, ...next].map((value) => ({ value, label: CASE_STATUS_LABEL[value] }));

  return (
    <div className="gm-card">
      <div className="gm-card__header">
        <h3>{item.title}</h3>
        <Badge tone={item.status === 'RESOLVED' || item.status === 'CONFIRMED' ? 'success' : item.status === 'DISMISSED' ? 'neutral' : 'warning'}>
          {CASE_STATUS_LABEL[item.status]}
        </Badge>
      </div>
      <p>{item.description}</p>
      <p className="gm-card__meta">
        {formatDateTime(item.createdAt)}
        {item.orderId && (
          <>
            {' · '}
            <Link to={`/admin/buyurtmalar/${item.orderId}`}>Buyurtmani ochish</Link>
          </>
        )}
        {' · Yuboruvchi: '}
        <UserRef id={item.openedById} />
        {item.targetUserId && (
          <>
            {' · Nishon: '}
            <UserRef id={item.targetUserId} />
          </>
        )}
      </p>
      {finished ? (
        <div style={{ marginTop: 'var(--gm-space-3)' }}>
          <Alert tone="info">Bu ish yakunlangan ({CASE_STATUS_LABEL[item.status]}). Yakunlangan holatni qayta o‘zgartirib bo‘lmaydi.</Alert>
          {item.decision && (
            <p className="gm-card__meta" style={{ marginTop: 'var(--gm-space-2)' }}>
              <strong>Qaror:</strong> {item.decision}
            </p>
          )}
        </div>
      ) : (
        <div className="gm-form" style={{ marginTop: 'var(--gm-space-3)' }}>
          {update.isError && <Alert tone="danger">{getErrorMessage(update.error)}</Alert>}
          <Select label="Yangi holat" options={options} value={status} onChange={(e) => setStatus(e.target.value as CaseStatus)} />
          <Textarea label="Qaror / izoh" rows={2} maxLength={2000} value={decision} onChange={(e) => setDecision(e.target.value)} />
          <div>
            <Button
              size="sm"
              loading={update.isPending}
              disabled={status === item.status}
              onClick={() => update.mutate({ id: item.id, status, decision: decision.trim() || undefined })}
            >
              Saqlash
            </Button>
            {status === item.status && <span className="gm-card__meta" style={{ marginLeft: 'var(--gm-space-3)' }}>Saqlash uchun yangi holatni tanlang</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminCasesPage() {
  const [searchParams] = useSearchParams();
  const initialKind = searchParams.get('kind');
  const [kind, setKind] = useState<'complaints' | 'disputes'>(initialKind === 'disputes' ? 'disputes' : 'complaints');
  const [status, setStatus] = useState<CaseStatus | ''>('');
  const cases = useAdminCases(kind, status || undefined);
  const items = cases.data?.items ?? [];

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>Shikoyat va nizolar</h1>
          <p className="gm-page-lead">Kelgan shikoyat va nizolarni hal qiling.</p>
        </div>
      </div>
      <div className="gm-tabs">
        <Button size="sm" variant={kind === 'complaints' ? 'primary' : 'secondary'} onClick={() => setKind('complaints')}>
          Shikoyatlar
        </Button>
        <Button size="sm" variant={kind === 'disputes' ? 'primary' : 'secondary'} onClick={() => setKind('disputes')}>
          Nizolar
        </Button>
      </div>
      <div className="gm-toolbar">
        <Select
          label="Holat bo‘yicha"
          options={[{ value: '', label: 'Hammasi' }, ...STATUS_OPTIONS]}
          value={status}
          onChange={(e) => setStatus(e.target.value as CaseStatus | '')}
        />
      </div>
      {cases.isLoading && <PageLoader />}
      {cases.isError && <Alert tone="danger">{getErrorMessage(cases.error)}</Alert>}
      {cases.data && items.length === 0 && <EmptyState title="Ro‘yxat bo‘sh" />}
      <div className="gm-list">
        {items.map((item) => (
          <CaseCard key={`${kind}-${item.id}-${item.status}`} item={item} kind={kind} />
        ))}
      </div>
    </div>
  );
}
