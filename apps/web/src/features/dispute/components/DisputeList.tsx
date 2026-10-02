import { CheckCircle2, FileText, Gavel, Scale } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/utils';
import { useMyDisputes } from '../hooks/useDisputes';
import { CASE_STATUS_LABEL } from '../types';

export function DisputeList() {
  const disputes = useMyDisputes();
  const items = disputes.data?.items ?? [];

  if (disputes.isLoading) return <PageLoader label="Nizolar yuklanmoqda…" />;
  if (disputes.isError) return <Alert tone="danger">{getErrorMessage(disputes.error)}</Alert>;
  if (items.length === 0) return (
      <EmptyState
        icon={<Scale size={34} strokeWidth={1.8} />}
        title="Nizolar yo‘q"
        description="Buyurtma bo‘yicha kelishmovchilik bo‘lsa, nizo ochishingiz mumkin. Ochilgan nizolar shu yerda ko‘rinadi."
        steps={[
          { icon: <FileText size={16} aria-hidden="true" />, title: 'Nizo oching', text: 'Buyurtma sahifasidan muammoni yozib yuboring.' },
          { icon: <Gavel size={16} aria-hidden="true" />, title: 'Ko‘rib chiqiladi', text: 'Administrator ikki tomonning fikrini o‘rganadi.' },
          { icon: <CheckCircle2 size={16} aria-hidden="true" />, title: 'Qaror chiqadi', text: 'Qaror va uning izohi shu yerda ko‘rinadi.' },
        ]}
      />
    );

  return (
    <div className="gm-list">
      {items.map((dispute) => (
        <div key={dispute.id} className="gm-card">
          <div className="gm-card__header">
            <h3>{dispute.title}</h3>
            <Badge tone="warning">{CASE_STATUS_LABEL[dispute.status]}</Badge>
          </div>
          <p>{dispute.description}</p>
          {dispute.decision && <p>Qaror: {dispute.decision}</p>}
          <p className="gm-card__meta">Ochilgan: {formatDateTime(dispute.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}
