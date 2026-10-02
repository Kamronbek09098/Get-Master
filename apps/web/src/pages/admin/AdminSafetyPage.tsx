import { UserRef } from '@/features/admin/components/UserRef';
import { UserNumberField } from '@/features/admin/components/UserNumberField';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/utils';
import {
  useAllActions,
  useAllAppeals,
  useCreateAction,
  useCreateCompensation,
  useLiftAction,
  useResolveAppeal,
} from '@/features/safety/hooks/useSafety';
import {
  ACTION_LABEL,
  APPEAL_LABEL,
  COMPENSATION_LABEL,
  RESTRICTION_LABEL,
} from '@/features/safety/types';
import type { AppealStatus, CompensationType, RestrictionType, UserActionType } from '@/features/safety/types';
import { t } from '@/i18n';

const ACTION_OPTIONS = (Object.keys(ACTION_LABEL) as UserActionType[]).map((value) => ({ value, label: ACTION_LABEL[value] }));
const RESTRICTION_OPTIONS = [
  { value: '', label: t('Yo‘q') },
  ...(Object.keys(RESTRICTION_LABEL) as RestrictionType[]).map((value) => ({ value, label: RESTRICTION_LABEL[value] })),
];
const COMPENSATION_OPTIONS = (Object.keys(COMPENSATION_LABEL) as CompensationType[]).map((value) => ({
  value,
  label: COMPENSATION_LABEL[value],
}));
const RESOLVE_OPTIONS: AppealStatus[] = ['UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'CLOSED'];

function ActionForm() {
  const create = useCreateAction();
  const [userId, setUserId] = useState<string | null>(null);
  const [type, setType] = useState<UserActionType>('WARNING');
  const [restriction, setRestriction] = useState('');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      {
        userId: userId ?? '',
        type,
        restrictionType: (restriction || undefined) as RestrictionType | undefined,
        reason: reason.trim(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      },
      { onSuccess: () => setReason('') },
    );
  }

  return (
    <form className="gm-form" onSubmit={handleSubmit}>
      {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}
      {create.isSuccess && <Alert tone="success">{t('Chora qo‘llandi.')}</Alert>}
      <UserNumberField label={t('Foydalanuvchi ID')} onResolve={setUserId} />
      <Select label={t('Chora turi')} options={ACTION_OPTIONS} value={type} onChange={(e) => setType(e.target.value as UserActionType)} />
      <Select label={t('Cheklov turi')} options={RESTRICTION_OPTIONS} value={restriction} onChange={(e) => setRestriction(e.target.value)} />
      <Input label={t('Tugash vaqti (ixtiyoriy)')} type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
      <Textarea label={t('Sabab')} required rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div>
        <Button type="submit" loading={create.isPending} disabled={!userId || !reason.trim()}>{t('Qo‘llash')}</Button>
      </div>
    </form>
  );
}

function CompensationForm() {
  const create = useCreateCompensation();
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [type, setType] = useState<CompensationType>('REFUND');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      { recipientId: recipientId ?? '', type, amount: amount ? Number(amount) : undefined, reason: reason.trim() },
      { onSuccess: () => setReason('') },
    );
  }

  return (
    <form className="gm-form" onSubmit={handleSubmit}>
      {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}
      {create.isSuccess && <Alert tone="success">{t('Kompensatsiya yaratildi.')}</Alert>}
      <UserNumberField label={t('Oluvchi ID')} onResolve={setRecipientId} />
      <Select label={t('Turi')} options={COMPENSATION_OPTIONS} value={type} onChange={(e) => setType(e.target.value as CompensationType)} />
      <Input label={t('Summa (ixtiyoriy)')} type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Textarea label={t('Sabab')} required rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div>
        <Button type="submit" loading={create.isPending} disabled={!recipientId || !reason.trim()}>{t('Yaratish')}</Button>
      </div>
    </form>
  );
}

function AppealCard({ id, status: initial, reason, decision: initialDecision, createdAt, userId }: {
  id: string;
  status: AppealStatus;
  reason: string;
  decision: string | null;
  createdAt: string;
  userId: string;
}) {
  const resolve = useResolveAppeal();
  const [decision, setDecision] = useState(initialDecision ?? '');
  const closed = initial === 'ACCEPTED' || initial === 'REJECTED' || initial === 'CLOSED';

  return (
    <div className="gm-card">
      <div className="gm-card__header">
        <h3>{formatDateTime(createdAt)}</h3>
        <Badge tone={initial === 'ACCEPTED' ? 'success' : initial === 'REJECTED' ? 'danger' : 'warning'}>{APPEAL_LABEL[initial]}</Badge>
      </div>
      <p>{reason}</p>
      <p className="gm-card__meta">{t('Foydalanuvchi:')}{' '}<UserRef id={userId} /></p>
      {decision && closed && <p className="gm-card__meta">{t('Qaror:')}{' '}{decision}</p>}
      {!closed && (
        <div className="gm-form">
          {resolve.isError && <Alert tone="danger">{getErrorMessage(resolve.error)}</Alert>}
          <Textarea label={t('Qaror')} rows={2} maxLength={2000} value={decision} onChange={(e) => setDecision(e.target.value)} />
          <div className="gm-action-row">
            {RESOLVE_OPTIONS.map((status) => (
              <Button
                key={status}
                size="sm"
                variant={status === 'ACCEPTED' ? 'primary' : 'secondary'}
                loading={resolve.isPending}
                onClick={() => resolve.mutate({ id, status, decision: decision.trim() || undefined })}
              >
                {APPEAL_LABEL[status]}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminSafetyPage() {
  const actions = useAllActions();
  const appeals = useAllAppeals();
  const lift = useLiftAction();
  const [tab, setTab] = useState<'actions' | 'appeals' | 'create' | 'compensation'>('appeals');

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>{t('Choralar va apellyatsiya')}</h1>
          <p className="gm-page-lead">{t('Akkauntingizga qo‘llangan choralar va apellyatsiya holati.')}</p>
        </div>
      </div>
      <div className="gm-tabs">
        {(
          [
            ['appeals', 'Apellyatsiyalar'],
            ['actions', 'Choralar'],
            ['create', t('Chora qo‘llash')],
            ['compensation', 'Kompensatsiya'],
          ] as const
        ).map(([key, label]) => (
          <Button key={key} size="sm" variant={tab === key ? 'primary' : 'secondary'} onClick={() => setTab(key)}>
            {label}
          </Button>
        ))}
      </div>

      {tab === 'appeals' && (
        <div className="gm-list">
          {appeals.isError && <Alert tone="danger">{getErrorMessage(appeals.error)}</Alert>}
          {appeals.data && appeals.data.length === 0 && <EmptyState title={t('Apellyatsiyalar yo‘q')} />}
          {(appeals.data ?? []).map((appeal) => (
            <AppealCard key={`${appeal.id}-${appeal.status}`} {...appeal} />
          ))}
        </div>
      )}

      {tab === 'actions' && (
        <div className="gm-list">
          {actions.isError && <Alert tone="danger">{getErrorMessage(actions.error)}</Alert>}
          {lift.isError && <Alert tone="danger">{getErrorMessage(lift.error)}</Alert>}
          {actions.data && actions.data.length === 0 && <EmptyState title={t('Choralar yo‘q')} />}
          {(actions.data ?? []).map((action) => (
            <div key={action.id} className="gm-card">
              <div className="gm-card__header">
                <h3>
                  {ACTION_LABEL[action.type]}
                  {action.restrictionType && ` — ${RESTRICTION_LABEL[action.restrictionType]}`}
                </h3>
                {action.liftedAt ? <Badge tone="neutral">{t('Bekor qilingan')}</Badge> : <Badge tone="danger">{t('Amalda')}</Badge>}
              </div>
              <p>{action.reason}</p>
              <p className="gm-card__meta">{t('Foydalanuvchi:')}{' '}<UserRef id={action.userId} /> · {formatDateTime(action.createdAt)}
                {action.expiresAt && t(' · Tugaydi: {dateTime}', { dateTime: formatDateTime(action.expiresAt) })}
              </p>
              {!action.liftedAt && (
                <Button size="sm" variant="secondary" loading={lift.isPending} onClick={() => lift.mutate(action.id)}>{t('Bekor qilish')}</Button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'create' && <ActionForm />}
      {tab === 'compensation' && <CompensationForm />}
    </div>
  );
}
