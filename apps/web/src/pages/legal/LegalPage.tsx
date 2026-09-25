import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate } from '@/lib/utils';
import { useAcceptPolicy, useMyAcceptances, usePolicies, usePolicy } from '@/features/legal/hooks/useLegal';
import { POLICY_TYPE_LABEL } from '@/features/legal/types';

export function LegalPage() {
  const policies = usePolicies();
  const acceptances = useMyAcceptances();
  const accept = useAcceptPolicy();
  const [openId, setOpenId] = useState<string | null>(null);
  const detail = usePolicy(openId);

  if (policies.isLoading) return <PageLoader label="Hujjatlar yuklanmoqda…" />;
  if (policies.isError) return <Alert tone="danger">{getErrorMessage(policies.error)}</Alert>;
  const items = (policies.data ?? []).filter((policy) => policy.status === 'PUBLISHED');
  const accepted = new Set((acceptances.data ?? []).map((item) => item.policyId));

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>Hujjatlar va shartlar</h1>
          <p className="gm-page-lead">Platforma shartlari va siyosatlari.</p>
        </div>
      </div>
      {accept.isError && <Alert tone="danger">{getErrorMessage(accept.error)}</Alert>}
      {items.length === 0 && <EmptyState title="Hozircha hujjatlar yo‘q" />}
      <div className="gm-list">
        {items.map((policy) => (
          <div key={policy.id} className="gm-card">
            <div className="gm-card__header">
              <h3>
                {policy.title} <small>v{policy.version}</small>
              </h3>
              {accepted.has(policy.id) ? <Badge tone="success">Qabul qilingan</Badge> : <Badge tone="warning">Qabul qilinmagan</Badge>}
            </div>
            <p className="gm-card__meta">
              {POLICY_TYPE_LABEL[policy.type]}
              {policy.publishedAt && ` · E’lon qilingan: ${formatDate(policy.publishedAt)}`}
            </p>
            <div className="gm-action-row">
              <Button size="sm" variant="secondary" onClick={() => setOpenId(openId === policy.id ? null : policy.id)}>
                {openId === policy.id ? 'Yashirish' : 'O‘qish'}
              </Button>
              {!accepted.has(policy.id) && (
                <Button size="sm" loading={accept.isPending} onClick={() => accept.mutate(policy.id)}>
                  Qabul qilaman
                </Button>
              )}
            </div>
            {openId === policy.id && (
              <div className="gm-detail-section">
                {detail.isLoading && <PageLoader />}
                {detail.isError && <Alert tone="danger">{getErrorMessage(detail.error)}</Alert>}
                {detail.data && <p className="gm-prose">{detail.data.content ?? policy.content}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
