import { Fragment, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  LogIn,
  MessageSquare,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDate, formatDateTime, formatRelativeTime } from '@/lib/utils';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { AccountLink } from '@/features/admin/components/AccountLink';
import { useAuditLogs } from '@/features/admin/hooks/useAdmin';
import { AUDIT_ACTIONS, DOCUMENT_LABEL, FIELD_LABEL, GROUP_INFO, TARGET_LABEL, actionInfo, formatValue } from '@/features/admin/audit-labels';
import type { AuditGroup } from '@/features/admin/audit-labels';
import type { AuditFilters, AuditLog } from '@/features/admin/types';
import './AdminAuditPage.css';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GROUP_ICON: Record<AuditGroup, ReactNode> = {
  auth: <LogIn size={18} />,
  verification: <ShieldCheck size={18} />,
  users: <Users size={18} />,
  profile: <UserCog size={18} />,
  catalog: <Wrench size={18} />,
  disputes: <Scale size={18} />,
  chat: <MessageSquare size={18} />,
  other: <CreditCard size={18} />,
};
const CATEGORY_CHIPS = (Object.keys(GROUP_INFO) as AuditGroup[]).filter((key) => GROUP_INFO[key].prefix);
const ACTION_OPTIONS = Object.entries(AUDIT_ACTIONS).sort((a, b) => a[1].label.localeCompare(b[1].label));

const dayStart = (value: string) => (value ? new Date(`${value}T00:00:00`).toISOString() : undefined);
const dayEnd = (value: string) => (value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined);
const timeOf = (value: string) => formatDateTime(value).split(', ')[1] ?? '';
const dayKey = (value: string) => new Date(value).toDateString();
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

interface Change {
  key: string;
  from: unknown;
  to: unknown;
  hasFrom: boolean;
  hasTo: boolean;
}

function changesOf(log: AuditLog): Change[] {
  const before = isObject(log.before) ? log.before : {};
  const after = isObject(log.after) ? log.after : {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys.map((key) => ({ key, from: before[key], to: after[key], hasFrom: key in before, hasTo: key in after }));
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="gm-audit__copy"
      title={`${label}ni nusxalash`}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function Person({ user, fallback }: { user: { id: string; accountNumber: number; firstName: string | null; lastName: string | null; phone: string } | null | undefined; fallback: string }) {
  if (!user) return <strong>{fallback}</strong>;
  return (
    <AccountLink userId={user.id} className="gm-audit__person">
      <ChatAvatar name={accountName(user)} seed={user.id} size="sm" />
      <strong>{accountName(user)}</strong>
      <small>ID {user.accountNumber}</small>
    </AccountLink>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="gm-audit__detail">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function AuditEntry({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  const info = actionInfo(log.action);
  const changes = changesOf(log);
  const targetName = log.targetType ? (TARGET_LABEL[log.targetType] ?? log.targetType) : null;
  const document = log.targetDocumentType ? (DOCUMENT_LABEL[log.targetDocumentType] ?? log.targetDocumentType) : null;
  // Ro‘yxatdan o‘tish kabi amallarda aktor yozilmaydi: amal egasi obyektning o‘zi.
  const actorUser = log.actor ?? (!log.actorId && info.group === 'auth' ? log.targetUser : null);
  const selfAction = !!actorUser && !!log.targetUser && actorUser.id === log.targetUser.id;

  return (
    <li className={cx('gm-audit__item', `gm-audit__item--${info.tone}`)}>
      <span className="gm-audit__icon" aria-hidden="true">
        {GROUP_ICON[info.group]}
      </span>
      <article className="gm-audit__card">
        <header className="gm-audit__head">
          <div className="gm-audit__title">
            <h3>{info.label}</h3>
            <Badge tone={info.tone}>{GROUP_INFO[info.group].label}</Badge>
          </div>
          <time dateTime={log.createdAt} title={formatDateTime(log.createdAt)}>
            <strong>{timeOf(log.createdAt)}</strong>
            <small>{formatRelativeTime(log.createdAt)}</small>
          </time>
        </header>

        <p className="gm-audit__sentence">
          <Person user={actorUser} fallback={log.actorId || info.group === 'auth' ? 'Noma’lum foydalanuvchi' : 'Tizim'} /> <span>{info.verb}</span>
          {log.targetUser && !selfAction && (
            <>
              {' '}
              <ArrowRight size={13} aria-hidden="true" className="gm-audit__arrow" /> <Person user={log.targetUser} fallback="" />
            </>
          )}
          {document && <Badge tone="neutral">{document}</Badge>}
        </p>

        {log.reason && (
          <blockquote className="gm-audit__reason">
            <small>Sabab</small>
            {log.reason}
          </blockquote>
        )}

        {changes.length > 0 && (
          <ul className="gm-audit__changes" aria-label="O‘zgarishlar">
            {changes.map((change) => (
              <li key={change.key}>
                <span className="gm-audit__field">{FIELD_LABEL[change.key] ?? change.key}</span>
                {change.hasFrom && <span className="gm-audit__value gm-audit__value--old">{formatValue(change.key, change.from)}</span>}
                {change.hasFrom && change.hasTo && <ArrowRight size={14} aria-hidden="true" />}
                {change.hasTo && <span className="gm-audit__value gm-audit__value--new">{formatValue(change.key, change.to)}</span>}
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="gm-audit__toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {open ? 'Yashirish' : 'Batafsil ma’lumot'}
        </button>

        {open && (
          <dl className="gm-audit__details">
            <Detail label="Aniq vaqt">{formatDateTime(log.createdAt)}</Detail>
            <Detail label="Amal kodi">
              <code>{log.action}</code>
            </Detail>
            {log.actor && (
              <Detail label="Bajaruvchi">
                <AccountLink userId={log.actor.id} className="gm-audit__link">
                  {accountName(log.actor)}
                </AccountLink>{' '}
                · ID {log.actor.accountNumber} · {log.actor.phone}
              </Detail>
            )}
            {log.targetUser && (
              <Detail label="Kimga nisbatan">
                <AccountLink userId={log.targetUser.id} className="gm-audit__link">
                  {accountName(log.targetUser)}
                </AccountLink>{' '}
                · ID {log.targetUser.accountNumber} · {log.targetUser.phone}
              </Detail>
            )}
            {targetName && (
              <Detail label="Obyekt">
                {targetName}
                {log.targetId && (
                  <>
                    {' '}
                    <code>{log.targetId}</code> <CopyButton value={log.targetId} label="Obyekt ID" />
                  </>
                )}
              </Detail>
            )}
            {log.ipAddress && <Detail label="IP manzil">{log.ipAddress}</Detail>}
            {log.device && <Detail label="Qurilma">{log.device}</Detail>}
            {log.requestId && (
              <Detail label="So‘rov ID">
                <code>{log.requestId}</code> <CopyButton value={log.requestId} label="So‘rov ID" />
              </Detail>
            )}
            {(log.before !== null && log.before !== undefined) || (log.after !== null && log.after !== undefined) ? (
              <Detail label="Xom ma’lumot (JSON)">
                <pre>{JSON.stringify({ oldin: log.before ?? null, keyin: log.after ?? null }, null, 2)}</pre>
              </Detail>
            ) : null}
          </dl>
        )}
      </article>
    </li>
  );
}

export function AdminAuditPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [action, setAction] = useState('');
  const [params] = useSearchParams();
  const [actorId, setActorId] = useState(params.get('actor') ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const actorValid = UUID.test(actorId.trim());
  const filters: AuditFilters = {
    search: search.trim() || undefined,
    category: action ? undefined : category || undefined,
    action: action || undefined,
    actorId: actorValid ? actorId.trim() : undefined,
    from: dayStart(from),
    to: dayEnd(to),
  };
  const logs = useAuditLogs(filters);
  const items = useMemo(() => logs.data?.pages.flatMap((page) => page.items) ?? [], [logs.data]);
  const active = !!(search || category || action || actorId || from || to);

  const reset = () => {
    setSearch('');
    setCategory('');
    setAction('');
    setActorId('');
    setFrom('');
    setTo('');
  };

  return (
    <div className="gm-audit">
      <div className="gm-page-header">
        <div>
          <h1>Audit jurnali</h1>
          <p className="gm-page-lead">Tizimda kim, qachon va nima qilgani: har bir muhim amal, uning sababi va o‘zgarishlari bilan.</p>
        </div>
      </div>

      <section className="gm-audit__filters" aria-label="Filtrlar">
        <div className="gm-audit__search">
          <Search size={16} aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Amal yoki sabab bo‘yicha qidirish" aria-label="Qidirish" />
        </div>
        <div className="gm-audit__chips" role="group" aria-label="Bo‘lim">
          <button type="button" aria-pressed={!category} className={cx('gm-otab', !category && 'gm-otab--active')} onClick={() => setCategory('')}>
            Hammasi
          </button>
          {CATEGORY_CHIPS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={category === GROUP_INFO[key].prefix}
              className={cx('gm-otab', category === GROUP_INFO[key].prefix && 'gm-otab--active')}
              onClick={() => {
                setCategory(GROUP_INFO[key].prefix ?? '');
                setAction('');
              }}
            >
              {GROUP_INFO[key].label}
            </button>
          ))}
        </div>
        <div className="gm-audit__row">
          <label>
            <span>Aniq amal</span>
            <select value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="">Barcha amallar</option>
              {ACTION_OPTIONS.map(([code, info]) => (
                <option key={code} value={code}>
                  {info.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Sanadan</span>
            <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            <span>Sanagacha</span>
            <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
          </label>
          <label className="gm-audit__grow">
            <span>Bajaruvchi ID (UUID)</span>
            <input value={actorId} onChange={(event) => setActorId(event.target.value)} placeholder="a7c1…" aria-invalid={!!actorId && !actorValid} />
          </label>
          {active && (
            <Button size="sm" variant="secondary" onClick={reset}>
              <X size={14} /> Tozalash
            </Button>
          )}
        </div>
      </section>

      {logs.isLoading && <PageLoader />}
      {logs.isError && <Alert tone="danger">{getErrorMessage(logs.error)}</Alert>}
      {logs.data && items.length === 0 && <EmptyState icon={<Sparkles size={26} />} title="Yozuvlar topilmadi" description={active ? 'Filtrlarni o‘zgartirib ko‘ring.' : undefined} />}

      {items.length > 0 && (
        <>
          <p className="gm-audit__count">
            {items.length} ta yozuv ko‘rsatilmoqda{logs.hasNextPage ? ' (yana bor)' : ''}
          </p>
          <ol className="gm-audit__timeline">
            {items.map((log, index) => (
              <Fragment key={log.id}>
                {(index === 0 || dayKey(items[index - 1]!.createdAt) !== dayKey(log.createdAt)) && (
                  <li className="gm-audit__day" aria-hidden="true">
                    <span>{formatDate(log.createdAt)}</span>
                  </li>
                )}
                <AuditEntry log={log} />
              </Fragment>
            ))}
          </ol>
          {logs.hasNextPage && (
            <div className="gm-audit__more">
              <Button variant="secondary" loading={logs.isFetchingNextPage} onClick={() => void logs.fetchNextPage()}>
                Ko‘proq yuklash
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
