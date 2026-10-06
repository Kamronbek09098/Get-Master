import { useState } from 'react';
import { AlertOctagon, AlertTriangle, Bug, Check, ChevronDown, Clock, Copy, MonitorSmartphone, RotateCcw, Search, Server, Users, WifiOff, type LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { AccountLink } from '@/features/admin/components/AccountLink';
import { useErrorGroups, useErrorList, useErrorSummary, useResolveErrors } from '@/features/errors/hooks';
import type { ErrorFilters, ErrorGroup, ErrorKind, ErrorLogItem, ErrorSummary } from '@/features/errors/types';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDateTime, formatRelativeTime } from '@/lib/utils';
import { useAppStore } from '@/store/app.store';
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

const STATUS_LABEL: Record<number, string> = {
  400: t('Noto‘g‘ri so‘rov'),
  401: t('Avtorizatsiya'),
  402: t('To‘lov talab qilinadi'),
  403: t('Ruxsat yo‘q'),
  404: t('Topilmadi'),
  405: t('Metod ruxsat etilmagan'),
  408: t('So‘rov vaqti tugadi'),
  409: t('Ziddiyat'),
  410: t('Mavjud emas'),
  413: t('Fayl juda katta'),
  415: t('Format qo‘llanmaydi'),
  422: t('Ma’lumot yaroqsiz'),
  423: t('Bloklangan'),
  429: t('Juda ko‘p so‘rov'),
  500: t('Server xatosi'),
  501: t('Amalga oshirilmagan'),
  502: t('Shlyuz xatosi'),
  503: t('Xizmat mavjud emas'),
  504: t('Shlyuz vaqti tugadi'),
};

type Tone = 'danger' | 'warning' | 'neutral';

function statusTone(status: number | null): Tone {
  if (status && status >= 500) return 'danger';
  if (status && status >= 400) return 'warning';
  return 'neutral';
}

function statusName(status: number | null, kind?: ErrorKind): string {
  if (!status) return kind ? KIND_LABEL[kind] : t('Tarmoq / interfeys');
  return STATUS_LABEL[status] ?? (status >= 500 ? t('Server xatosi') : t('Mijoz xatosi'));
}

function toneOf(item: { status: number | null; severity: 'ERROR' | 'WARNING'; kind: ErrorKind }): Tone {
  if (item.status) return statusTone(item.status);
  return item.severity === 'ERROR' ? 'danger' : 'warning';
}

function kindIcon(kind: ErrorKind): LucideIcon {
  if (kind === 'NETWORK') return WifiOff;
  if (kind === 'UI_CRASH' || kind === 'UI_ERROR') return Bug;
  return Server;
}

function where(item: { method: string | null; path: string | null; pageUrl: string | null }): string {
  if (item.path) return `${item.method ? `${item.method} ` : ''}${item.path.replace(/^\/api\/v1/, '')}`;
  return item.pageUrl ?? '—';
}

/** Chap tomondagi katta belgi: HTTP status raqami yoki (status bo‘lmasa) turiga mos ikonka. */
function StatusTile({ item }: { item: { status: number | null; severity: 'ERROR' | 'WARNING'; kind: ErrorKind } }) {
  const Icon = kindIcon(item.kind);
  return (
    <div className={cx('gm-errs__tile', `gm-errs__tile--${toneOf(item)}`)} aria-hidden="true">
      {item.status ? <strong>{item.status}</strong> : <Icon size={26} />}
      <span>{item.status ? statusName(item.status) : KIND_LABEL[item.kind]}</span>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const pushToast = useAppStore((s) => s.pushToast);
  return (
    <button
      type="button"
      className="gm-errs__copy"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(
          () => pushToast(t('Nusxa olindi'), 'success'),
          () => undefined,
        );
      }}
    >
      <Copy size={13} aria-hidden="true" />
      {label}
    </button>
  );
}

function Stat({ icon: Icon, label, value, hint, tone }: { icon: LucideIcon; label: string; value: number | string; hint?: string; tone?: 'danger' | 'warn' | 'ok' }) {
  return (
    <div className={cx('gm-errs__stat', tone && `gm-errs__stat--${tone}`)}>
      <span className="gm-errs__stat-icon" aria-hidden="true"><Icon size={18} /></span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
    </div>
  );
}

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/** Oxirgi 7 kun: ma’lumot bo‘lmagan kunlar ham 0 bilan ko‘rsatiladi. */
function Daily({ rows }: { rows: ErrorSummary['daily'] }) {
  const byDay = new Map(rows.map((row) => [dayKey(new Date(row.day)), row]));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const row = byDay.get(dayKey(date));
    return { date, total: row?.total ?? 0, errors: row?.errors ?? 0 };
  });
  const max = Math.max(1, ...days.map((day) => day.total));
  const total = days.reduce((sum, day) => sum + day.total, 0);
  return (
    <section className="gm-errs__panel">
      <div className="gm-errs__panel-head">
        <span className="gm-errs__label">{t('Oxirgi 7 kun')} · {total}</span>
        <div className="gm-errs__legend">
          <span><i className="gm-errs__dot gm-errs__dot--error" />{t('Jiddiy')}</span>
          <span><i className="gm-errs__dot gm-errs__dot--warn" />{t('Ogohlantirish')}</span>
        </div>
      </div>
      <div className="gm-errs__daily">
        {days.map((day) => {
          const warn = day.total - day.errors;
          return (
            <div key={day.date.toISOString()} className="gm-errs__bar" title={`${day.date.toLocaleDateString()}: ${day.total} (${day.errors} ${t('jiddiy')})`}>
              <em>{day.total || ''}</em>
              <span className="gm-errs__bar-col">
                <i className="gm-errs__seg gm-errs__seg--warn" style={{ height: `${(warn / max) * 100}%` }} />
                <i className="gm-errs__seg gm-errs__seg--error" style={{ height: `${(day.errors / max) * 100}%` }} />
              </span>
              <small>{day.date.toLocaleDateString(undefined, { weekday: 'short' })}<br />{day.date.getDate()}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Tanlangan kategoriya: '' (hammasi) | '4xx' | '5xx' | 'none' | aniq status kodi. */
function categoryOf(filters: ErrorFilters): string {
  return filters.statusClass ?? filters.status ?? '';
}

function StatusFilter({ rows, value, onChange }: { rows: ErrorSummary['byStatus']; value: string; onChange: (value: string) => void }) {
  const sum = (test: (status: number) => boolean) => rows.filter((row) => test(row.status)).reduce((acc, row) => acc + row.count, 0);
  const classes: Array<{ value: string; label: string; hint: string; count: number; tone: Tone }> = [
    { value: '', label: t('Hammasi'), hint: t('barcha turlar'), count: sum(() => true), tone: 'neutral' },
    { value: '4xx', label: '4xx', hint: t('Mijoz xatolari'), count: sum((s) => s >= 400 && s < 500), tone: 'warning' },
    { value: '5xx', label: '5xx', hint: t('Server xatolari'), count: sum((s) => s >= 500), tone: 'danger' },
    { value: 'none', label: t('Boshqa'), hint: t('Tarmoq / interfeys'), count: sum((s) => s < 400), tone: 'neutral' },
  ];
  const exact = rows.filter((row) => row.status >= 400);
  return (
    <section className="gm-errs__panel" aria-label={t('Xato turlari')}>
      <span className="gm-errs__label">{t('Xato turlari')} <small>({t('hal qilinmagan, 7 kun')})</small></span>
      <div className="gm-errs__cats">
        {classes.map((item) => (
          <button key={item.value} type="button" className={cx('gm-errs__cat', `gm-errs__cat--${item.tone}`, value === item.value && 'is-active')} aria-pressed={value === item.value} onClick={() => onChange(item.value)}>
            <strong>{item.count}</strong>
            <b>{item.label}</b>
            <span>{item.hint}</span>
          </button>
        ))}
      </div>
      {exact.length > 0 && (
        <div className="gm-errs__codes">
          {exact.map((row) => (
            <button key={row.status} type="button" className={cx('gm-errs__chip', `gm-errs__chip--${statusTone(row.status)}`, value === String(row.status) && 'is-active')} aria-pressed={value === String(row.status)} onClick={() => onChange(value === String(row.status) ? '' : String(row.status))} title={row.lastSeenAt ? `${t('Oxirgi marta')}: ${formatDateTime(row.lastSeenAt)}` : undefined}>
              <b>{row.status}</b>
              <span>{statusName(row.status)}</span>
              <em>{row.count}</em>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Meta({ children, icon: Icon }: { children: React.ReactNode; icon: LucideIcon }) {
  return <span className="gm-errs__meta"><Icon size={14} aria-hidden="true" />{children}</span>;
}

function sourceLabel(item: { source: 'SERVER' | 'CLIENT'; platform?: string | null }): string {
  return item.source === 'SERVER' ? t('Server') : PLATFORM_LABEL[item.platform ?? 'web'] ?? t('Veb / ilova');
}

function GroupCard({ group, onOpen }: { group: ErrorGroup; onOpen: (fingerprint: string) => void }) {
  const resolve = useResolveErrors();
  const done = group.openCount === 0;
  return (
    <article className={cx('gm-errs__card', done && 'gm-errs__card--done')}>
      <StatusTile item={group} />
      <div className="gm-errs__body">
        <div className="gm-errs__top">
          <div className="gm-errs__badges">
            <Badge tone={group.severity === 'ERROR' ? 'danger' : 'warning'}>{group.severity === 'ERROR' ? t('Jiddiy') : t('Ogohlantirish')}</Badge>
            <Badge tone="neutral">{sourceLabel(group)}</Badge>
            {group.code && <Badge tone="neutral">{group.code}</Badge>}
            {done && <Badge tone="success">{t('Hal qilingan')}</Badge>}
          </div>
          <span className="gm-errs__count" title={t('Takrorlanishlar soni')}>{group.count}<small>×</small></span>
        </div>
        <h3 className="gm-errs__title">{group.message}</h3>
        <code className="gm-errs__where">{where(group)}</code>
        <div className="gm-errs__metas">
          <Meta icon={Users}>{group.users ? `${group.users} ${t('foydalanuvchi')}` : t('Noma’lum foydalanuvchi')}</Meta>
          <Meta icon={Clock}>{t('Oxirgi')}: {formatRelativeTime(group.lastSeenAt)}</Meta>
          <span className="gm-errs__meta gm-errs__meta--muted">{t('Birinchi')}: {formatDateTime(group.firstSeenAt)}</span>
        </div>
        <div className="gm-errs__actions">
          <Button size="sm" variant="secondary" onClick={() => onOpen(group.fingerprint)}>{t('Barcha yozuvlarni ko‘rish')}</Button>
          <Button size="sm" variant={done ? 'secondary' : 'primary'} loading={resolve.isPending} onClick={() => resolve.mutate({ fingerprint: group.fingerprint, value: !done })}>
            {done ? <RotateCcw size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}{' '}{done ? t('Qayta ochish') : t('Hal qilindi')}
          </Button>
        </div>
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
    <article className={cx('gm-errs__card', done && 'gm-errs__card--done')}>
      <StatusTile item={item} />
      <div className="gm-errs__body">
        <div className="gm-errs__top">
          <div className="gm-errs__badges">
            <Badge tone={item.severity === 'ERROR' ? 'danger' : 'warning'}>{item.severity === 'ERROR' ? t('Jiddiy') : t('Ogohlantirish')}</Badge>
            <Badge tone="neutral">{sourceLabel(item)}</Badge>
            {item.panel && <Badge tone="neutral">{PANEL_LABEL[item.panel] ?? item.panel}</Badge>}
            {item.code && <Badge tone="neutral">{item.code}</Badge>}
            {done && <Badge tone="success">{t('Hal qilingan')}</Badge>}
          </div>
          <time className="gm-errs__time" dateTime={item.createdAt} title={formatDateTime(item.createdAt)}>{formatRelativeTime(item.createdAt)}</time>
        </div>
        <h3 className="gm-errs__title">{item.message}</h3>
        <code className="gm-errs__where">{where(item)}</code>
        <div className="gm-errs__metas">
          <Meta icon={Users}>{who}</Meta>
          <Meta icon={Clock}>{formatDateTime(item.createdAt)}</Meta>
          <Meta icon={MonitorSmartphone}>{KIND_LABEL[item.kind]}</Meta>
        </div>
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
                <div className="gm-errs__panel-head"><span className="gm-errs__label">{t('Qo‘shimcha ma’lumot')}</span><CopyButton text={JSON.stringify(item.context, null, 2)} label={t('Nusxa')} /></div>
                <pre className="gm-errs__pre">{JSON.stringify(item.context, null, 2)}</pre>
              </div>
            )}
            {item.stack && (
              <div>
                <div className="gm-errs__panel-head"><span className="gm-errs__label">Stack trace</span><CopyButton text={item.stack} label={t('Nusxa')} /></div>
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
          {item.requestId && <CopyButton text={item.requestId} label={t('So‘rov ID')} />}
          <Button size="sm" variant="secondary" loading={resolve.isPending} onClick={() => resolve.mutate({ ids: [item.id], value: !done })}>
            {done ? t('Qayta ochish') : t('Hal qilindi')}
          </Button>
        </div>
      </div>
    </article>
  );
}

const STATE_OPTIONS = () => [{ value: '', label: t('Hammasi') }, { value: 'open', label: t('Hal qilinmagan') }, { value: 'resolved', label: t('Hal qilingan') }];

/** Superadmin: tizimdagi barcha xatoliklar (server, veb sayt, mobil ilova). */
export function AdminErrorsPage() {
  const [view, setView] = useState<'groups' | 'list'>('groups');
  const [days, setDays] = useState(7);
  const [filters, setFilters] = useState<ErrorFilters>({ state: 'open' });
  const [search, setSearch] = useState('');
  const summary = useErrorSummary();
  const groups = useErrorGroups(days, { status: filters.status, statusClass: filters.statusClass, state: filters.state || undefined }, view === 'groups');
  const list = useErrorList(filters, view === 'list');
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;
  const set = (patch: Partial<ErrorFilters>) => setFilters((prev) => ({ ...prev, ...patch }));

  function setCategory(value: string) {
    if (value === '4xx' || value === '5xx' || value === 'none') set({ statusClass: value, status: undefined });
    else set({ statusClass: undefined, status: value || undefined });
  }

  function openGroup(fingerprint: string) {
    setFilters({ fingerprint, state: '' });
    setView('list');
  }

  const data = summary.data;
  return (
    <div className="gm-errs">
      <div className="gm-page-header">
        <div>
          <h1>{t('Errorlar')}</h1>
          <p className="gm-page-lead">{t('Server, veb sayt va mobil ilovada yuz bergan barcha xatoliklar: kim, qachon va nima qilganda.')}</p>
        </div>
      </div>

      {summary.isError && <Alert tone="danger">{getErrorMessage(summary.error)}</Alert>}

      {data && (
        <>
          <section className="gm-errs__stats" aria-label={t('Qisqacha')}>
            <Stat icon={AlertTriangle} label={t('Oxirgi 24 soatda')} value={data.last24h} />
            <Stat icon={AlertOctagon} label={t('Shundan jiddiy')} value={data.last24hErrors} tone={data.last24hErrors ? 'danger' : 'ok'} />
            <Stat icon={Clock} label={t('Hal qilinmagan')} value={data.openTotal} tone={data.openTotal ? 'warn' : 'ok'} />
            <Stat icon={Users} label={t('Ta’sirlangan foydalanuvchi')} hint={t('oxirgi 24 soat')} value={data.affectedUsers24h} />
          </section>
          <Daily rows={data.daily ?? []} />
          <StatusFilter rows={data.byStatus ?? []} value={categoryOf(filters)} onChange={setCategory} />
        </>
      )}

      <div className="gm-errs__tabs" role="tablist">
        <button type="button" role="tab" aria-selected={view === 'groups'} className={cx('gm-errs__tab', view === 'groups' && 'is-active')} onClick={() => setView('groups')}>{t('Guruhlangan')}</button>
        <button type="button" role="tab" aria-selected={view === 'list'} className={cx('gm-errs__tab', view === 'list' && 'is-active')} onClick={() => setView('list')}>{t('Barcha yozuvlar')}</button>
      </div>

      {view === 'groups' ? (
        <>
          <div className="gm-errs__filters">
            <Select label={t('Davr')} value={String(days)} onChange={(e) => setDays(Number(e.target.value))} options={[{ value: '1', label: t('Oxirgi 24 soat') }, { value: '7', label: t('Oxirgi 7 kun') }, { value: '30', label: t('Oxirgi 30 kun') }]} />
            <Select label={t('Holat')} value={filters.state ?? ''} onChange={(e) => set({ state: e.target.value as ErrorFilters['state'] })} options={STATE_OPTIONS()} />
          </div>
          {groups.isLoading && <PageLoader />}
          {groups.isError && <Alert tone="danger">{getErrorMessage(groups.error)}</Alert>}
          {groups.data && groups.data.length === 0 && <EmptyState icon={<AlertOctagon size={32} />} title={t('Xatolik yo‘q')} description={t('Tanlangan davr va filtr bo‘yicha xatolik topilmadi.')} />}
          {groups.data && groups.data.length > 0 && <p className="gm-errs__total"><AlertTriangle size={14} aria-hidden="true" /> {t('Guruhlar')}: {groups.data.length}</p>}
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
            <Select label={t('Holat')} value={filters.state ?? ''} onChange={(e) => set({ state: e.target.value as ErrorFilters['state'] })} options={STATE_OPTIONS()} />
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
