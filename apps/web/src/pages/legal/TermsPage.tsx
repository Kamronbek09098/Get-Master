import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, FileText } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { PageLoader } from '@/components/common/PageLoader';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate } from '@/lib/utils';
import { usePolicies, usePolicy } from '@/features/legal/hooks/useLegal';
import { POLICY_TYPE_LABEL } from '@/features/legal/types';
import './TermsPage.css';

function PolicyBody({ id, fallback }: { id: string; fallback?: string }) {
  const detail = usePolicy(id);
  if (detail.isLoading) return <PageLoader />;
  if (detail.isError) return <Alert tone="danger">{getErrorMessage(detail.error)}</Alert>;
  return <div className="gm-terms__prose">{detail.data?.content ?? fallback ?? 'Matn mavjud emas.'}</div>;
}

/** Hammaga ochiq sahifa: kirmasdan ham foydalanish shartlari va siyosatlarni o‘qish mumkin. */
export function TermsPage() {
  const policies = usePolicies();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const items = (policies.data ?? []).filter((policy) => policy.status === 'PUBLISHED');

  return (
    <div className="gm-terms">
      <header className="gm-terms__bar">
        <Link to="/" aria-label="GetMaster — bosh sahifa">
          <Logo />
        </Link>
        <button type="button" className="gm-terms__back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/register'))}>
          <ArrowLeft size={16} aria-hidden="true" /> Ortga
        </button>
      </header>

      <main className="gm-terms__main">
        <h1>Foydalanish shartlari va siyosatlar</h1>
        <p className="gm-terms__lead">Ro‘yxatdan o‘tishdan oldin hujjatlar bilan tanishib chiqing. Ularni kirmasdan ham o‘qish mumkin.</p>

        {policies.isLoading && <PageLoader label="Hujjatlar yuklanmoqda…" />}
        {policies.isError && <Alert tone="danger">{getErrorMessage(policies.error)}</Alert>}
        {!policies.isLoading && !policies.isError && items.length === 0 && <EmptyState title="Hozircha hujjatlar e’lon qilinmagan" />}

        <ul className="gm-terms__list">
          {items.map((policy) => {
            const open = openId === policy.id;
            return (
              <li key={policy.id} className={open ? 'gm-terms__item gm-terms__item--open' : 'gm-terms__item'}>
                <button type="button" className="gm-terms__head" aria-expanded={open} onClick={() => setOpenId(open ? null : policy.id)}>
                  <span className="gm-terms__icon" aria-hidden="true">
                    <FileText size={18} />
                  </span>
                  <span className="gm-terms__title">
                    <strong>{policy.title}</strong>
                    <small>
                      {POLICY_TYPE_LABEL[policy.type]} · v{policy.version}
                      {policy.publishedAt && ` · ${formatDate(policy.publishedAt)}`}
                    </small>
                  </span>
                  <ChevronDown size={18} className="gm-terms__chevron" aria-hidden="true" />
                </button>
                {open && (
                  <div className="gm-terms__body">
                    <PolicyBody id={policy.id} fallback={policy.content} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
