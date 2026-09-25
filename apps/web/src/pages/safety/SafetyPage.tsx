import { useState } from 'react';
import type { FormEvent } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime, formatMoney } from '@/lib/utils';
import { useCreateAppeal, useMyActions, useMyAppeals, useMyCompensations } from '@/features/safety/hooks/useSafety';
import { ACTION_LABEL, APPEAL_LABEL, COMPENSATION_LABEL, RESTRICTION_LABEL } from '@/features/safety/types';

export function SafetyPage() {
  const actions = useMyActions();
  const appeals = useMyAppeals();
  const compensations = useMyCompensations();
  const createAppeal = useCreateAppeal();
  const [actionId, setActionId] = useState('');
  const [reason, setReason] = useState('');

  function handleAppeal(event: FormEvent) {
    event.preventDefault();
    createAppeal.mutate(
      { reason: reason.trim(), actionId: actionId || undefined },
      { onSuccess: () => setReason('') },
    );
  }

  const activeActions = (actions.data ?? []).filter((action) => !action.liftedAt);

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>Choralar va apellyatsiya</h1>
          <p className="gm-page-lead">Akkauntingizga qo‘llangan choralar va apellyatsiya holati.</p>
        </div>
      </div>

      <section className="gm-detail-section">
        <h2>Menga qo‘llangan choralar</h2>
        {actions.isLoading && <PageLoader />}
        {actions.isError && <Alert tone="danger">{getErrorMessage(actions.error)}</Alert>}
        {actions.data && actions.data.length === 0 && <EmptyState title="Sizga nisbatan chora qo‘llanmagan" />}
        <div className="gm-list">
          {(actions.data ?? []).map((action) => (
            <div key={action.id} className="gm-card">
              <div className="gm-card__header">
                <h3>
                  {ACTION_LABEL[action.type]}
                  {action.restrictionType && ` — ${RESTRICTION_LABEL[action.restrictionType]}`}
                </h3>
                {action.liftedAt ? <Badge tone="neutral">Bekor qilingan</Badge> : <Badge tone="danger">Amalda</Badge>}
              </div>
              <p>{action.reason}</p>
              <p className="gm-card__meta">
                Boshlangan: {formatDateTime(action.startsAt)}
                {action.expiresAt && ` · Tugaydi: ${formatDateTime(action.expiresAt)}`}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="gm-detail-section">
        <h2>Apellyatsiya yuborish</h2>
        <form className="gm-form" onSubmit={handleAppeal}>
          {createAppeal.isError && <Alert tone="danger">{getErrorMessage(createAppeal.error)}</Alert>}
          {createAppeal.isSuccess && <Alert tone="success">Apellyatsiya yuborildi.</Alert>}
          {activeActions.length > 0 && (
            <Select
              label="Qaysi chora ustidan"
              value={actionId}
              onChange={(e) => setActionId(e.target.value)}
              options={[
                { value: '', label: 'Tanlanmagan' },
                ...activeActions.map((action) => ({ value: action.id, label: `${ACTION_LABEL[action.type]} — ${formatDateTime(action.createdAt)}` })),
              ]}
            />
          )}
          <Textarea label="Sabab" required rows={4} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div>
            <Button type="submit" loading={createAppeal.isPending} disabled={!reason.trim()}>
              Yuborish
            </Button>
          </div>
        </form>
      </section>

      <section className="gm-detail-section">
        <h2>Mening apellyatsiyalarim</h2>
        {appeals.data && appeals.data.length === 0 && <EmptyState title="Apellyatsiyalar yo‘q" />}
        <div className="gm-list">
          {(appeals.data ?? []).map((appeal) => (
            <div key={appeal.id} className="gm-card">
              <div className="gm-card__header">
                <h3>{formatDateTime(appeal.createdAt)}</h3>
                <Badge tone={appeal.status === 'ACCEPTED' ? 'success' : appeal.status === 'REJECTED' ? 'danger' : 'warning'}>
                  {APPEAL_LABEL[appeal.status]}
                </Badge>
              </div>
              <p>{appeal.reason}</p>
              {appeal.decision && <p className="gm-card__meta">Qaror: {appeal.decision}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="gm-detail-section">
        <h2>Kompensatsiyalar</h2>
        {compensations.data && compensations.data.length === 0 && <EmptyState title="Kompensatsiyalar yo‘q" />}
        <div className="gm-list">
          {(compensations.data ?? []).map((item) => (
            <div key={item.id} className="gm-card">
              <div className="gm-card__header">
                <h3>{COMPENSATION_LABEL[item.type]}</h3>
                {item.amount && <strong>{formatMoney(item.amount, item.currency)}</strong>}
              </div>
              <p>{item.reason}</p>
              <p className="gm-card__meta">{formatDateTime(item.createdAt)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
