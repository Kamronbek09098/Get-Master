import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, FileText, Lock, ScrollText, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { PageLoader } from '@/components/common/PageLoader';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate } from '@/lib/utils';
import { usePolicies, usePolicy } from '@/features/legal/hooks/useLegal';
import { POLICY_TYPE_LABEL } from '@/features/legal/types';
import type { PolicyType } from '@/features/legal/types';
import './TermsPage.css';

const ICONS: Partial<Record<PolicyType, LucideIcon>> = { TERMS: FileText, PRIVACY: Lock, PLATFORM_RULES: ScrollText, WARRANTY: ShieldCheck };

/** Matnni bloklarga ajratadi: «## sarlavha», «- ro‘yxat», oddiy abzatslar. */
function renderContent(content: string): ReactNode {
  return content
    .trim()
    .split(/\n{2,}/)
    .map((block, index) => {
      const lines = block.split('\n');
      if (lines.length === 1 && lines[0]?.startsWith('## ')) return <h3 key={index}>{lines[0].slice(3)}</h3>;
      // Sarlavha va uning ostidagi ro‘yxat/abzats bitta blokda kelgan bo‘lishi mumkin.
      const nodes: ReactNode[] = [];
      let bullets: string[] = [];
      const flush = () => {
        if (bullets.length > 0) {
          nodes.push(
            <ul key={`ul-${nodes.length}`}>
              {bullets.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>,
          );
          bullets = [];
        }
      };
      lines.forEach((line) => {
        if (line.startsWith('## ')) {
          flush();
          nodes.push(<h3 key={`h-${nodes.length}`}>{line.slice(3)}</h3>);
        } else if (line.startsWith('- ')) {
          bullets.push(line.slice(2));
        } else {
          flush();
          nodes.push(<p key={`p-${nodes.length}`}>{line}</p>);
        }
      });
      flush();
      return <div key={index}>{nodes}</div>;
    });
}

function PolicyBody({ id, fallback }: { id: string; fallback?: string }) {
  const detail = usePolicy(id);
  if (detail.isLoading) return <PageLoader />;
  if (detail.isError) return <Alert tone="danger">{getErrorMessage(detail.error)}</Alert>;
  return <div className="gm-terms__prose">{renderContent(detail.data?.content ?? fallback ?? 'Matn mavjud emas.')}</div>;
}

/** Hammaga ochiq sahifa: kirmasdan ham foydalanish shartlari va siyosatlarni o‘qish mumkin. */
export function TermsPage() {
  const policies = usePolicies();
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);
  const items = (policies.data ?? []).filter((policy) => policy.status === 'PUBLISHED');
  // Birinchi hujjat dastlab ochiq turadi.
  const current = openId === undefined ? (items[0]?.id ?? null) : openId;

  return (
    <div className="gm-terms">
      <header className="gm-terms__bar">
        <Link to="/" aria-label="GetMaster — bosh sahifa">
          <Logo />
        </Link>
      </header>

      <main className="gm-terms__main">
        <section className="gm-terms__hero">
          <span className="gm-terms__hero-icon" aria-hidden="true">
            <ScrollText size={26} />
          </span>
          <h1>Foydalanish shartlari va siyosatlar</h1>
          <p className="gm-terms__lead">Ro‘yxatdan o‘tishdan oldin hujjatlar bilan tanishib chiqing. Ularni kirmasdan ham o‘qish mumkin.</p>
          {items.length > 0 && <span className="gm-terms__count">{items.length} ta hujjat</span>}
        </section>

        {policies.isLoading && <PageLoader label="Hujjatlar yuklanmoqda…" />}
        {policies.isError && <Alert tone="danger">{getErrorMessage(policies.error)}</Alert>}
        {!policies.isLoading && !policies.isError && items.length === 0 && <EmptyState title="Hozircha hujjatlar e’lon qilinmagan" />}

        <ul className="gm-terms__list">
          {items.map((policy) => {
            const open = current === policy.id;
            const Icon = ICONS[policy.type] ?? FileText;
            return (
              <li key={policy.id} className={open ? 'gm-terms__item gm-terms__item--open' : 'gm-terms__item'}>
                <button type="button" className="gm-terms__head" aria-expanded={open} onClick={() => setOpenId(open ? null : policy.id)}>
                  <span className="gm-terms__icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <span className="gm-terms__title">
                    <strong>{policy.title}</strong>
                    <span className="gm-terms__chips">
                      <span>{POLICY_TYPE_LABEL[policy.type]}</span>
                      <span>v{policy.version}</span>
                      {policy.publishedAt && <span>{formatDate(policy.publishedAt)}</span>}
                    </span>
                  </span>
                  <ChevronDown size={20} className="gm-terms__chevron" aria-hidden="true" />
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

        <footer className="gm-terms__foot">
          <p>© {new Date().getFullYear()} GetMaster. Savollar bo‘lsa, ilovadagi «Shikoyatlar» bo‘limi orqali murojaat qiling.</p>
        </footer>
      </main>
    </div>
  );
}
