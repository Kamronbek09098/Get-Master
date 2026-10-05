import { useState } from 'react';
import { AlertOctagon, AlertTriangle, Check, ChevronDown, RotateCcw, Search, Users } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { AccountLink } from '@/features/admin/components/AccountLink';
import { useErrorGroups, useErrorList, useErrorSummary, useResolveErrors } from '@/features/errors/hooks';
import type { ErrorFilters, ErrorGroup, ErrorKind, ErrorLogItem } from '@/features/errors/types';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDateTime, formatRelativeTime } from '@/lib/utils';
import { t } from '@/i18n';
import './AdminErrorsPage.css';

const KIND_LABEL: Record<ErrorKind, string> = {
  HTTP: t('Server so‘rovi'),
  UNHANDLED: t('Ushlanmagan xato'),
  UI_CRASH: t('Interfeys qulashi'),
  UI_ERROR: t('Interfeys xatosi'),
  API_ERROR: t('API xabari'),
  NETWORK: t('Tarmoq xatosi'),
};
const PANEL_LABEL: Record<string, string> = { CUSTOMER: t('Mijoz'), MASTER: t('Usta'), ADMIN: t('Admin') };
const PLATFORM_LABEL: Record<string, string> = { web: t('Veb sayt'), android: 'Android', ios: 'iOS' };

function where(item: { method: string | null; path: string | null; pageUrl: string | null }): string {
  if (item.path) return `${item.method ? `${item.method} ` : ''}${item.path.replace(/^\/api\/v1/, '')}`;
  return item.pageUrl ?? '—';
}

function headline(item: { status: number | null; code: string | null; kind: ErrorKind }): string {
  const parts = [item.status ? `HTTP ${item.status}` : null, item.code].filter(Boolean);
  return parts.length ? parts.join(' · ') : KIND_LABEL[item.kind];
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'danger' | 'warn' }) {
  return (
    <div className={cx('gm-errs__stat', tone && `gm-errs__stat--${tone}`)}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Daily({ rows }: { rows: Array<{ day: string; total: number; errors: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.total));
  return (
    <div className="gm-errs__daily" aria-label={t('Oxirgi 7 kun')}>
      {rows.map((row) => (
        <div key={row.day} className="gm-errs__bar" title={`${new Date(row.day).toLocaleDateString()}: ${row.total} (${row.errors} ${t('jiddiy')})`}>
          <span style={{ height: `${Math.max(6, (row.total / max) * 100)}%` }}>
            <i style={{ height: `${row.total ? (row.errors / row.total) * 100 : 0}%` }} />
          </span>
          <small>{new Date(row.day).getDate()}</small>
        </div>
      ))}
    </div>
  );
}

function GroupCard({ group, onOpen }: { group: ErrorGroup; onOpen: (fingerprint: string) => void }) {
  const resolve = useResolveErrors();
  const done = group.openCount === 0;
  return (
    <article className={cx('gm-errs__card', `gm-errs__card--${group.severity.toLowerCase()}`, done && 'gm-errs__card--done')}>
      <div className="gm-errs__top">
        <div className="gm-errs__badges">
          <Badge tone={group.severity === 'ERROR' ? 'danger' : 'warning'}>{group.severity === 'ERROR' ? t('Jiddiy') : t('Ogohlantirish')}</Badge>
          <Badge tone="neutral">{group.source === 'SERVER' ? t('Server') : t('Veb / ilova')}</Badge>
          <Badge tone="neutral">{KIND_LABEL[group.kind]}</Badge>
          {done && <Badge tone="success">{t('Hal qilingan')}</Badge>}
        </div>
        <span className="gm-errs__count" title={t('Takrorlanishlar soni')}>{group.count}×</span>
      </div>
      <h3 className="gm-errs__title">{group.message}</h3>
      <p className="gm-errs__code">{headline(group)} · <code>{where(group)}</code></p>
      <dl className="gm-errs__facts">
        <div><dt>{t('Ta’sirlangan foydalanuvchi')}</dt><dd>{group.users || '—'}</dd></div>
        <div><dt>{t('Birinchi marta')}</dt><dd>{formatDateTime(group.firstSeenAt)}</dd></div>
        <div><dt>{t('Oxirgi marta')}</dt><dd>{formatDateTime(group.lastSeenAt)} · {formatRelativeTime(group.lastSeenAt)}</dd></div>
      </dl>
      <div className="gm-errs__actions">
        <Button size="sm" variant="secondary" onClick={() => onOpen(group.fingerprint)}>{t('Barcha yozuvlarni ko‘rish')}</Button>
        <Button size="sm" variant={done ? 'secondary' : 'primary'} loading={resolve.isPending} onClick={() => resolve.mutate({ fingerprint: group.fingerprint, value: done })}>
          {done ? <RotateCcw size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}{' '}{done ? t('Qayta ochish') : t('Hal qilindi')}
        </Button>
      </div>
    </article>
  );
}

function LogCard({ item }: { item: ErrorLogItem }) {
  const [open, setOpen] = useState(false);
  const resolve = useResolveErrors();
  const done = !!item.resolvedAt;
  const who = item.user ? (
    <AccountLink accountNumber={item.user.accountNumber} className="gm-userref">
      {accountName(item.user)} · ID {item.user.accountNumber}
    </AccountLink>
  ) : (
    <span>{t('Kirmagan / noma’lum')}</span>
  );
  return (
    <article className={cx('gm-errs__card', `gm-errs__card--${item.severity.toLowerCase()}`, done && 'gm-errs__card--done')}>
      <div className="gm-errs__top">
        <div className="gm-errs__badges">
          <Badge tone={item.severity === 'ERROR' ? 'danger' : 'warning'}>{headline(item)}</Badge>
          <Badge tone="neutral">{item.source === 'SERVER' ? t('Server') : PLATFORM_LABEL[item.platform ?? 'web'] ?? t('Veb / ilova')}</Badge>
          {item.panel && <Badge tone="neutral">{PANEL_LABEL[item.panel] ?? item.panel}</Badge>}
          {done && <Badge tone="success">{t('Hal qilingan')}</Badge>}
        </div>
        <time className="gm-errs__time" dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
      </div>
      <h3 className="gm-errs__title">{item.message}</h3>
      <dl className="gm-errs__facts">
        <div><dt>{t('Kim')}</dt><dd>{who}</dd></div>
        <div><dt>{t('Qayerda')}</dt><dd><code>{where(item)}</code></dd></div>
        <div><dt>{t('Turi')}</dt><dd>{KIND_LABEL[item.kind]}</dd></div>
      </dl>
      {open && (
        <div className="gm-errs__more">
          <dl className="gm-errs__grid">
            {item.userRole && <div><dt>{t('Rol')}</dt><dd>{item.userRole}</dd></div>}
            {item.user?.phone && <div><dt>{t('Telefon')}</dt><dd>{item.user.phone}</dd></div>}
            {item.pageUrl && <div><dt>{t('Sahifa')}</dt><dd><code>{item.pageUrl}</code></dd></div>}
            {item.requestId && <div><dt>{t('So‘rov ID')}</dt><dd><code>{item.requestId}</code></dd></div>}
            {item.ipAddress && <div><dt>IP</dt><dd>{item.ipAddress}</dd></div>}
            {item.appVersion && <div><dt>{t('Ilova versiyasi')}</dt><dd>{item.appVersion}</dd></div>}
            {item.userAgent && <div className="gm-errs__wide"><dt>{t('Qurilma / brauzer')}</dt><dd>{item.userAgent}</dd></div>}
          </dl>
          {item.context && Object.keys(item.context).length > 0 && (
            <div>
              <span className="gm-errs__label">{t('Qo‘shimcha ma’lumot')}</span>
              <pre className="gm-errs__pre">{JSON.stringify(item.context, null, 2)}</pre>
            </div>
          )}
          {item.stack && (
            <div>
              <span className="gm-errs__label">Stack trace</span>
              <pre className="gm-errs__pre">{item.stack}</pre>
            </div>
          )}
        </div>
      )}
      <div className="gm-errs__actions">
        <button type="button" className="gm-errs__toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? t('Yig‘ish') : t('Batafsil')}
          <ChevronDown size={16} aria-hidden="true" className={open ? 'is-up' : ''} />
        </button>
        <Button size="sm" variant="secondary" loading={resolve.isPending} onClick={() => resolve.mutate({ ids: [item.id], value: !done })}>
          {done ? t('Qayta ochish') : t('Hal qilindi')}
        </Button>
      </div>
    </article>
  );
}

/** Superadmin: tizimdagi barcha xatoliklar (server, veb sayt, mobil ilova). */
export function AdminErrorsPage() {
  const [view, setView] = useState<'groups' | 'list'>('groups');
  const [days, setDays] = useState(7);
  const [filters, setFilters] = useState<ErrorFilters>({ state: 'open' });
  const [search, setSearch] = useState('');
  const summary = useErrorSummary();
  const groups = useErrorGroups(days, view === 'groups');
  const list = useErrorList(filters, view === 'list');
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;
  const set = (patch: Partial<ErrorFilters>) => setFilters((prev) => ({ ...prev, ...patch }));
  const forbidden = summary.isError;

  function openGroup(fingerprint: string) {
    setFilters({ fingerprint, state: '' });
    setView('list');
  }

  return (
    <div className="gm-errs">
      <div className="gm-page-header">
        <div>
          <h1>{t('Errorlar')}</h1>
          <p className="gm-page-lead">{t('Server, veb sayt va mobil ilovada yuz bergan barcha xatoliklar: kim, qachon va nima qilganda.')}</p>
        </div>
      </div>

      {forbidden && <Alert tone="danger">{getErrorMessage(summary.error)}</Alert>}

      {summary.data && (
        <>
          <section className="gm-errs__stats" aria-label={t('Qisqacha')}>
            <Stat label={t('Oxirgi 24 soatda')} value={summary.data.last24h} />
            <Stat label={t('Shundan jiddiy')} value={summary.data.last24hErrors} tone={summary.data.last24hErrors ? 'danger' : undefined} />
            <Stat label={t('Hal qilinmagan')} value={summary.data.openTotal} tone={summary.data.openTotal ? 'warn' : undefined} />
            <Stat label={t('Ta’sirlangan foydalanuvchi (24 soat)')} value={summary.data.affectedUsers24h} />
          </section>
          {summary.data.daily.length > 0 && (
            <section className="gm-errs__panel">
              <span className="gm-errs__label">{t('Oxirgi 7 kun')}</span>
              <Daily rows={summary.data.daily} />
            </section>
          )}
        </>
      )}

      <div className="gm-tabs gm-errs__tabs">
        <Button size="sm" variant={view === 'groups' ? 'primary' : 'secondary'} onClick={() => setView('groups')}>{t('Guruhlangan')}</Button>
        <Button size="sm" variant={view === 'list' ? 'primary' : 'secondary'} onClick={() => setView('list')}>{t('Barcha yozuvlar')}</Button>
      </div>

      {view === 'groups' ? (
        <>
          <div className="gm-errs__filters">
            <Select label={t('Davr')} value={String(days)} onChange={(e) => setDays(Number(e.target.value))} options={[{ value: '1', label: t('Oxirgi 24 soat') }, { value: '7', label: t('Oxirgi 7 kun') }, { value: '30', label: t('Oxirgi 30 kun') }]} />
          </div>
          {groups.isLoading && <PageLoader />}
          {groups.isError && <Alert tone="danger">{getErrorMessage(groups.error)}</Alert>}
          {groups.data && groups.data.length === 0 && <EmptyState icon={<AlertOctagon size={32} />} title={t('Xatolik yo‘q')} description={t('Tanlangan davrda xatolik qayd etilmagan.')} />}
          <div className="gm-errs__list">
            {groups.data?.map((group) => <GroupCard key={group.fingerprint} group={group} onOpen={openGroup} />)}
          </div>
        </>
      ) : (
        <>
          <form
            className="gm-errs__filters"
            onSubmit={(event) => {
              event.preventDefault();
              set({ q: search.trim() || undefined });
            }}
          >
            <Input label={t('Qidirish')} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Xabar, kod, yo‘l yoki so‘rov ID')} />
            <Input label={t('Foydalanuvchi ID')} inputMode="numeric" value={filters.accountNumber ?? ''} onChange={(e) => set({ accountNumber: e.target.value.replace(/\D/g, '') || undefined })} />
            <Select label={t('Manba')} value={filters.source ?? ''} onChange={(e) => set({ source: e.target.value as ErrorFilters['source'] })} options={[{ value: '', label: t('Hammasi') }, { value: 'SERVER', label: t('Server') }, { value: 'CLIENT', label: t('Veb / ilova') }]} />
            <Select label={t('Daraja')} value={filters.severity ?? ''} onChange={(e) => set({ severity: e.target.value as ErrorFilters['severity'] })} options={[{ value: '', label: t('Hammasi') }, { value: 'ERROR', label: t('Jiddiy') }, { value: 'WARNING', label: t('Ogohlantirish') }]} />
            <Select label={t('Panel')} value={filters.panel ?? ''} onChange={(e) => set({ panel: e.target.value || undefined })} options={[{ value: '', label: t('Hammasi') }, { value: 'CUSTOMER', label: t('Mijoz') }, { value: 'MASTER', label: t('Usta') }, { value: 'ADMIN', label: t('Admin') }]} />
            <Select label={t('Qurilma')} value={filters.platform ?? ''} onChange={(e) => set({ platform: e.target.value || undefined })} options={[{ value: '', label: t('Hammasi') }, { value: 'web', label: t('Veb sayt') }, { value: 'android', label: 'Android' }, { value: 'ios', label: 'iOS' }]} />
            <Select label={t('Holat')} value={filters.state ?? ''} onChange={(e) => set({ state: e.target.value as ErrorFilters['state'] })} options={[{ value: '', label: t('Hammasi') }, { value: 'open', label: t('Hal qilinmagan') }, { value: 'resolved', label: t('Hal qilingan') }]} />
            <Button type="submit" variant="secondary"><Search size={16} aria-hidden="true" />{' '}{t('Qidirish')}</Button>
          </form>
          {filters.fingerprint && (
            <Alert tone="info">
              {t('Faqat bitta guruh yozuvlari ko‘rsatilmoqda.')}{' '}
              <button type="button" className="gm-errs__link" onClick={() => set({ fingerprint: undefined })}>{t('Filtrni olib tashlash')}</button>
            </Alert>
          )}
          {list.isLoading && <PageLoader />}
          {list.isError && <Alert tone="danger">{getErrorMessage(list.error)}</Alert>}
          {list.data && items.length === 0 && <EmptyState icon={<AlertTriangle size={32} />} title={t('Yozuv topilmadi')} description={t('Filtrlarni o‘zgartirib ko‘ring.')} />}
          {items.length > 0 && <p className="gm-errs__total"><Users size={14} aria-hidden="true" /> {t('Jami')}: {total}</p>}
          <div className="gm-errs__list">
            {items.map((item) => <LogCard key={item.id} item={item} />)}
          </div>
          {list.hasNextPage && (
            <div className="gm-errs__more-btn">
              <Button variant="secondary" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>{t('Ko‘proq yuklash')}</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
