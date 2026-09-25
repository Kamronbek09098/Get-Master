import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/utils';
import { CASE_STATUS_LABEL } from '@/features/dispute/types';
import { useMyComplaints } from '../hooks/useComplaints';

export function ComplaintList() {
  const complaints = useMyComplaints();
  const items = complaints.data?.items ?? [];

  if (complaints.isLoading) return <PageLoader label="Shikoyatlar yuklanmoqda…" />;
  if (complaints.isError) return <Alert tone="danger">{getErrorMessage(complaints.error)}</Alert>;
  if (items.length === 0) return <EmptyState title="Shikoyatlar yo‘q" />;

  return (
    <div className="gm-list">
      {items.map((complaint) => (
        <div key={complaint.id} className="gm-card">
          <div className="gm-card__header">
            <h3>{complaint.title}</h3>
            <Badge tone="primary">{CASE_STATUS_LABEL[complaint.status]}</Badge>
          </div>
          <p>{complaint.description}</p>
          {complaint.decision && <p>Qaror: {complaint.decision}</p>}
          <p className="gm-card__meta">Yuborildi: {formatDateTime(complaint.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}
