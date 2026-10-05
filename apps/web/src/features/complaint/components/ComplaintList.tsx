import { useState } from 'react';
import { CheckCircle2, ChevronDown, PenLine, Search, ShieldAlert } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/utils';
import { CASE_STATUS_LABEL } from '@/features/dispute/types';
import type { Complaint } from '../types';
import { useMyComplaints } from '../hooks/useComplaints';
import { useMe } from '@/features/session/hooks/useMe';
import { accountName } from '@/lib/account-name';
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
        <ComplaintCard key={complaint.id} complaint={complaint} />
      ))}
    </div>
  );
}

function ComplaintCard({ complaint }: { complaint: Complaint }) {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const sender = accountName(me.data);
  const senderNo = me.data?.accountNumber;
  const tone = complaint.status === 'RESOLVED' || complaint.status === 'CONFIRMED' ? 'ok' : complaint.status === 'DISMISSED' ? 'no' : 'wait';
  const closed = tone !== 'wait';
  const reviewing = complaint.status !== 'REPORTED';
  const panelId = `cplt-${complaint.id}`;

  return (
    <article className={`gm-cplt__item gm-cplt__item--${tone}`}>
      <div className="gm-cplt__top">
        <span className="gm-cplt__no">{t('Shikoyat')} № {complaint.id.slice(0, 8).toUpperCase()}</span>
        <Badge tone={tone === 'ok' ? 'success' : tone === 'no' ? 'danger' : 'primary'}>{CASE_STATUS_LABEL[complaint.status]}</Badge>
      </div>

      <h3 className="gm-cplt__title">{complaint.title}</h3>
      {!open && <p className="gm-cplt__text gm-cplt__text--clamp">{complaint.description}</p>}
      <p className="gm-cplt__date">{formatDateTime(complaint.createdAt)}</p>

      {open && (
        <div id={panelId} className="gm-cplt__more">
          <dl className="gm-cplt__meta-grid">
            <div>
              <dt>{t('Yuboruvchi')}</dt>
              <dd>{sender}{senderNo ? ` · № ${senderNo}` : ''}</dd>
            </div>
            <div>
              <dt>{t('Qabul qiluvchi')}</dt>
              <dd>{t('GetMaster administratsiyasi')}</dd>
            </div>
            <div>
              <dt>{t('Yuborilgan vaqt')}</dt>
              <dd>{formatDateTime(complaint.createdAt)}</dd>
            </div>
            <div>
              <dt>{t('Bog‘liq buyurtma')}</dt>
              <dd>{complaint.orderId ? `№ ${complaint.orderId.slice(0, 8).toUpperCase()}` : t('Umumiy shikoyat')}</dd>
            </div>
          </dl>

          <div className="gm-cplt__block">
            <span className="gm-cplt__label">{t('Tavsif')}</span>
            <p className="gm-cplt__text">{complaint.description}</p>
          </div>

          <ol className="gm-cplt__steps" aria-label={t('Holat')}>
            <li className="is-done">{t('Yuborildi')}</li>
            <li className={reviewing ? 'is-done' : ''}>{t('Ko‘rib chiqilmoqda')}</li>
            <li className={closed ? `is-done is-${tone}` : ''}>{closed ? CASE_STATUS_LABEL[complaint.status] : t('Qaror')}</li>
          </ol>

          {complaint.decision ? (
            <div className="gm-cplt__decision">
              <strong>{t('Administrator qarori')}</strong>
              <p>{complaint.decision}</p>
            </div>
          ) : (
            <p className="gm-cplt__waiting">{t('Qaror hali chiqarilmagan — murojaatingiz ko‘rib chiqilmoqda.')}</p>
          )}
        </div>
      )}

      <button type="button" className="gm-cplt__toggle" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen((v) => !v)}>
        {open ? t('Yig‘ish') : t('To‘liq ko‘rish')}
        <ChevronDown size={16} aria-hidden="true" className={open ? 'is-up' : ''} />
      </button>
    </article>
  );
}
