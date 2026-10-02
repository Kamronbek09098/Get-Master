import { CheckCircle2, PenLine, Search, ShieldAlert } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/utils';
import { CASE_STATUS_LABEL } from '@/features/dispute/types';
import { useMyComplaints } from '../hooks/useComplaints';
import { t } from '@/i18n';

export function ComplaintList() {
  const complaints = useMyComplaints();
  const items = complaints.data?.items ?? [];

  if (complaints.isLoading) return <PageLoader label={t('Shikoyatlar yuklanmoqda…')} />;
  if (complaints.isError) return <Alert tone="danger">{getErrorMessage(complaints.error)}</Alert>;
  if (items.length === 0) return (
      <EmptyState
        icon={<ShieldAlert size={34} strokeWidth={1.8} />}
        title={t('Shikoyatlar yo‘q')}
        description={t('Xizmat sifatidan norozi bo‘lsangiz, quyidagi shakl orqali shikoyat yuboring. Yuborilganlar shu yerda ko‘rinadi.')}
        steps={[
          { icon: <PenLine size={16} aria-hidden="true" />, title: t('Shikoyat yozing'), text: t('Mavzu va batafsil tavsifni kiriting.') },
          { icon: <Search size={16} aria-hidden="true" />, title: t('Ko‘rib chiqiladi'), text: t('Murojaatingiz administrator tomonidan o‘rganiladi.') },
          { icon: <CheckCircle2 size={16} aria-hidden="true" />, title: t('Javob oling'), text: t('Qaror shu yerda holati bilan ko‘rinadi.') },
        ]}
      />
    );

  return (
    <div className="gm-list">
      {items.map((complaint) => (
        <div key={complaint.id} className="gm-card">
          <div className="gm-card__header">
            <h3>{complaint.title}</h3>
            <Badge tone="primary">{CASE_STATUS_LABEL[complaint.status]}</Badge>
          </div>
          <p>{complaint.description}</p>
          {complaint.decision && <p>{t('Qaror:')}{' '}{complaint.decision}</p>}
          <p className="gm-card__meta">{t('Yuborildi:')}{' '}{formatDateTime(complaint.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}
