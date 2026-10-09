import { ChevronDown } from 'lucide-react';
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
import { CASE_STATUS_LABEL, caseTitle, caseTone } from '@/features/dispute/types';
import type { CaseItem, CaseStatus } from '@/features/dispute/types';
import { t } from '@/i18n';
import './AdminCasesPage.css';

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
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<CaseStatus>(item.status);
  const [decision, setDecision] = useState(item.decision ?? '');
  const next = NEXT_STATUSES[item.status];
  const finished = next.length === 0;
  const options = [item.status, ...next].map((value) => ({ value, label: CASE_STATUS_LABEL[value] }));
  const tone = caseTone(item.status);
  const reviewing = item.status !== 'REPORTED';
  const panelId = `case-${item.id}`;

  return (
    <article className={`gm-acase gm-acase--${tone}`}>
      <div className="gm-acase__top">
        <span className="gm-acase__no">
          {kind === 'complaints' ? t('Shikoyat') : t('Nizo')} № {item.id.slice(0, 8).toUpperCase()}
        </span>
        <Badge tone={tone === 'ok' ? 'success' : tone === 'no' ? 'danger' : 'warning'}>{CASE_STATUS_LABEL[item.status]}</Badge>
      </div>

      <h3 className="gm-acase__title">{caseTitle(item.title, item.orderId)}</h3>
      {!open && <p className="gm-acase__text gm-acase__text--clamp">{item.description}</p>}

      <dl className="gm-acase__facts">
        <div>
          <dt>{t('Yuboruvchi')}</dt>
          <dd><UserRef id={item.openedById} /></dd>
        </div>
        {item.targetUserId && (
          <div>
            <dt>{t('Nishon')}</dt>
            <dd><UserRef id={item.targetUserId} /></dd>
          </div>
        )}
        <div>
          <dt>{t('Vaqt')}</dt>
          <dd>{formatDateTime(item.createdAt)}</dd>
        </div>
        {item.orderId && (
          <div>
            <dt>{t('Buyurtma')}</dt>
            <dd><Link to={`/admin/buyurtmalar/${item.orderId}`}>{t('Buyurtmani ochish')}</Link></dd>
          </div>
        )}
      </dl>

      {open && (
        <div id={panelId} className="gm-acase__more">
          <div className="gm-acase__block">
            <span className="gm-acase__label">{t('Tavsif')}</span>
            <p className="gm-acase__text">{item.description}</p>
          </div>

          <ol className="gm-acase__steps" aria-label={t('Holat')}>
            <li className="is-done">{t('Yuborildi')}</li>
            <li className={reviewing ? 'is-done' : ''}>{t('Ko‘rib chiqilmoqda')}</li>
            <li className={finished ? `is-done is-${tone}` : ''}>{finished ? CASE_STATUS_LABEL[item.status] : t('Qaror')}</li>
          </ol>

          {finished ? (
            <>
              <Alert tone="info">{t('Bu ish yakunlangan ({item}). Yakunlangan holatni qayta o‘zgartirib bo‘lmaydi.', { item: CASE_STATUS_LABEL[item.status] })}</Alert>
              {item.decision && (
                <div className="gm-acase__decision">
                  <strong>{t('Qaror:').replace(/:$/, '')}</strong>
                  <p>{item.decision}</p>
                </div>
              )}
            </>
          ) : (
            <div className="gm-form gm-acase__form">
              {update.isError && <Alert tone="danger">{getErrorMessage(update.error)}</Alert>}
              <Select label={t('Yangi holat')} options={options} value={status} onChange={(e) => setStatus(e.target.value as CaseStatus)} />
              <Textarea label={t('Qaror / izoh')} rows={3} maxLength={2000} value={decision} onChange={(e) => setDecision(e.target.value)} />
              <div className="gm-acase__actions">
                <Button
                  loading={update.isPending}
                  disabled={status === item.status}
                  onClick={() => update.mutate({ id: item.id, status, decision: decision.trim() || undefined })}
                >{t('Saqlash')}</Button>
                {status === item.status && <span className="gm-acase__hint">{t('Saqlash uchun yangi holatni tanlang')}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      <button type="button" className="gm-acase__toggle" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen((v) => !v)}>
        {open ? t('Yig‘ish') : finished ? t('To‘liq ko‘rish') : t('Ko‘rib chiqish')}
        <ChevronDown size={16} aria-hidden="true" className={open ? 'is-up' : ''} />
      </button>
    </article>
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
    <div className="gm-acases">
      <div className="gm-page-header">
        <div>
          <h1>{t('Shikoyat va nizolar')}</h1>
          <p className="gm-page-lead">{t('Kelgan shikoyat va nizolarni hal qiling.')}</p>
        </div>
      </div>
      <div className="gm-tabs">
        <Button size="sm" variant={kind === 'complaints' ? 'primary' : 'secondary'} onClick={() => setKind('complaints')}>{t('Shikoyatlar')}</Button>
        <Button size="sm" variant={kind === 'disputes' ? 'primary' : 'secondary'} onClick={() => setKind('disputes')}>{t('Nizolar')}</Button>
      </div>
      <div className="gm-toolbar">
        <Select
          label={t('Holat bo‘yicha')}
          options={[{ value: '', label: t('Hammasi') }, ...STATUS_OPTIONS]}
          value={status}
          onChange={(e) => setStatus(e.target.value as CaseStatus | '')}
        />
      </div>
      {cases.isLoading && <PageLoader />}
      {cases.isError && <Alert tone="danger">{getErrorMessage(cases.error)}</Alert>}
      {cases.data && items.length === 0 && <EmptyState title={t('Ro‘yxat bo‘sh')} />}
      <div className="gm-list">
        {items.map((item) => (
          <CaseCard key={`${kind}-${item.id}-${item.status}`} item={item} kind={kind} />
        ))}
      </div>
    </div>
  );
}
