import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, BadgeCheck, CalendarCheck, ChevronRight, ClipboardList, Clapperboard, Crown, Database, Eye, Heart, MessageCircle, PackageCheck, RefreshCw, Scale, ServerCrash, ShieldCheck, Users, Wallet, Wrench } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDateTime, formatMoney } from '@/lib/utils';
import { statusLabel } from '@/lib/labels';
import { accountName } from '@/lib/account-name';
import { useDashboard, useDevOps, useOrdersSeries } from '@/features/admin/hooks/useAdmin';
import type { SubscriptionAudienceStats } from '@/features/admin/types';
import { useMe } from '@/features/session/hooks/useMe';
import { OrdersChart } from '@/features/admin/components/OrdersChart';
import { AdminSearch } from '@/features/admin/components/AdminSearch';
import { PeriodPill } from '@/features/admin/components/PeriodPill';
import { toRange } from '@/features/admin/range';
import './AdminDashboardPage.css';
import { t } from '@/i18n';

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="gm-dash-section">
      <header className="gm-dash-section__head">
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
      </header>
      {children}
    </section>
  );
}

function MiniStat({ icon, tone, value, label, long = false }: { icon: ReactNode; tone: string; value: string | number; label: string; long?: boolean }) {
  return (
    <div className={cx('gm-mini', `gm-mini--${tone}`, long && 'gm-mini--long')}>
      <span className="gm-mini__icon" aria-hidden="true">{icon}</span>
      <span className="gm-mini__body">
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}

function SubscriptionCard({ kind, title, stats }: { kind: 'customer' | 'master'; title: string; stats: SubscriptionAudienceStats }) {
  const rows: Array<{ label: string; value: string | number; tone?: 'warn' | 'ok' }> = [
    { label: t('Sotib olingan'), value: stats.purchased },
    { label: t('Sovg‘a qilingan'), value: stats.gifted },
    { label: t('Tasdiq kutayotgan'), value: stats.pending, tone: stats.pending > 0 ? 'warn' : undefined },
    { label: t('7 kunda tugaydi'), value: stats.expiringSoon, tone: stats.expiringSoon > 0 ? 'warn' : undefined },
  ];
  return (
    <div className={`gm-sub gm-sub--${kind}`}>
      <header className="gm-sub__head">
        <span className="gm-sub__icon" aria-hidden="true">{kind === 'customer' ? <Users size={20} /> : <Wrench size={20} />}</span>
        <div>
          <h3>{title}</h3>
          <p>{stats.planName ? `${stats.planName} · ${stats.monthlyPrice != null ? formatMoney(stats.monthlyPrice) : ''} / ${t('oy')}` : t('Reja yo‘q')}</p>
        </div>
        <span className="gm-sub__active"><b>{stats.active}</b><small>{t('faol')}</small></span>
      </header>
      <dl className="gm-sub__rows">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd className={row.tone ? `is-${row.tone}` : undefined}>{row.value}</dd>
          </div>
        ))}
      </dl>
      <footer className="gm-sub__foot">
        <span>{t('Obuna tushumi')}</span>
        <strong>{formatMoney(stats.revenue)}</strong>
      </footer>
    </div>
  );
}

function Panel({ title, action, badge, children, className }: { title: string; action?: { to: string; label: string }; badge?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('gm-dpanel', className)}>
      <header className="gm-dpanel__head">
        <h2>{title}</h2>
        {badge}
        {action && (
          <Link to={action.to} className="gm-dpanel__link">
            {action.label} <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

const ORDER_TONE: Record<string, 'ok' | 'info' | 'warn' | 'bad' | 'off'> = {
  COMPLETED: 'ok', IN_PROGRESS: 'info', ON_THE_WAY: 'info', ARRIVED: 'info', CONFIRMED: 'info', WAITING_CONFIRMATION: 'warn',
  BOOKED: 'warn', SUBMITTED: 'warn', MATCHING: 'warn', OFFERS_RECEIVED: 'warn', CANCELLED: 'off', EXPIRED: 'off', DISPUTED: 'bad',
};
const GOOD = new Set(['COMPLETED', 'VERIFIED', 'ACTIVE', 'SUCCEEDED', 'RESOLVED']);
const toneOf = (status: string) => ORDER_TONE[status] ?? 'off';


/** Pastdagi «Holatlar bo‘yicha» kartasi: jami, eng ko‘p ikki holat va «yaxshi» holatlar ulushi. */
function StatusCard({ icon, title, counts, good, accent }: { icon: ReactNode; title: string; counts: Record<string, unknown>; good: string; accent: string }) {
  const entries = Object.entries(counts)
    .map(([key, value]) => [key, typeof value === 'object' && value !== null ? Number((value as { count?: number }).count ?? 0) : Number(value ?? 0)] as const)
    .sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const goodCount = entries.filter(([key]) => key === good || (good === '*' && GOOD.has(key))).reduce((sum, [, count]) => sum + count, 0);
  const percent = total ? Math.round((goodCount / total) * 100) : 0;
  return (
    <div className="gm-sc" style={{ '--gm-sc': accent } as CSSProperties}>
      <div className="gm-sc__top">
        <span className="gm-sc__icon" aria-hidden="true">{icon}</span>
        <div className="gm-sc__main">
          <span className="gm-sc__title">{title}</span>
          <strong className="gm-sc__total">{total}</strong>
        </div>
        <ul className="gm-sc__list">
          {entries.slice(0, 2).map(([key, count]) => (
            <li key={key}><span>{statusLabel(key)}</span><b>{count}</b></li>
          ))}
        </ul>
      </div>
      <div className="gm-sc__bar" aria-hidden="true"><span style={{ width: `${Math.max(percent, total ? 3 : 0)}%` }} /></div>
      <span className="gm-sc__pct">{percent}%</span>
    </div>
  );
}

export function AdminDashboardPage() {
  const [range, setRange] = useState({ from: '', to: '' });
  const [days, setDays] = useState<7 | 30 | 90>(7);
  const me = useMe();
  const dashboard = useDashboard(toRange(range));
  const series = useOrdersSeries(days);
  const devops = useDevOps('1h');
  const data = dashboard.data;
  const filtered = !!range.from || !!range.to;
  const periodNote = filtered ? t('Tanlangan davr') : t('Butun davr');
  const updated = dashboard.dataUpdatedAt ? formatDateTime(new Date(dashboard.dataUpdatedAt).toISOString()) : null;
  const orderCounts = data ? Object.entries(data.orders.byStatus).sort((a, b) => b[1] - a[1]) : [];
  const orderTotal = orderCounts.reduce((sum, [, count]) => sum + count, 0);
  const stable = devops.data ? devops.data.issues.length === 0 : null;

  return (
    <div className="gm-dash">
      <div className="gm-dash-top">
        <div className="gm-dash-top__title">
          <nav className="gm-dash-crumbs" aria-label={t('Joylashuv')}>
            <span>{t('Boshqaruv')}</span> <ChevronRight size={12} aria-hidden="true" /> <span>{t('Umumiy ko‘rinish')}</span>
          </nav>
          <h1>{t('Boshqaruv paneli')}</h1>
          <p className="gm-page-lead">{t('GetMaster platformasining bugungi holati')}</p>
        </div>
        <div className="gm-dash-top__search"><AdminSearch /></div>
        <div className="gm-dash-top__tools">
          <div className="gm-dash-top__row">
            <PeriodPill value={range} onChange={setRange} />
            <Button variant="secondary" onClick={() => void dashboard.refetch()} loading={dashboard.isFetching && !dashboard.isLoading}>
              <RefreshCw size={16} /> {t('Yangilash')}
            </Button>
          </div>
          {updated && <span className="gm-dash-top__time">{t('Oxirgi yangilanish')}: {updated}</span>}
        </div>
      </div>

      {dashboard.isLoading && <PageLoader label={t('Statistika yuklanmoqda…')} />}
      {dashboard.isError && <Alert tone="danger">{getErrorMessage(dashboard.error)}</Alert>}

      {data && (
        <>
          <section className="gm-attn" aria-label={t('E’tibor talab qiladigan ishlar')}>
            <header className="gm-attn__head">
              <span className="gm-attn__mark" aria-hidden="true">!</span>
              <h2>{t('E’tibor talab qiladigan ishlar')}</h2>
              <Link to="/admin/shikoyatlar" className="gm-dpanel__link">{t('Barchasini ko‘rish')} <ArrowRight size={14} aria-hidden="true" /></Link>
            </header>
            <div className="gm-attn__grid">
              {[
                { to: '/admin/tasdiqlash', icon: <BadgeCheck size={22} />, tone: 'info', title: t('Ustalarni tasdiqlash'), sub: t('Yangi arizalar va hujjatlar'), count: data.attention.pendingVerifications },
                { to: '/admin/shikoyatlar', icon: <AlertTriangle size={22} />, tone: 'warn', title: t('Ochiq nizolar'), sub: t('Mijozlar va ustalar o‘rtasida'), count: data.attention.openCases },
                { to: '/admin/obunalar', icon: <Crown size={22} />, tone: 'info', title: t('Obunalar'), sub: t('Tasdiq kutayotgan to‘lovlar'), count: data.attention.pendingSubscriptions },
                { to: '/admin/errorlar', icon: <ServerCrash size={22} />, tone: 'bad', title: t('Server xatolari'), sub: t('Oxirgi 24 soat · tizim jurnali'), count: data.attention.errors24h },
              ].map((item) => (
                <Link key={item.title} to={item.to} className={cx('gm-attn__item', `gm-attn__item--${item.tone}`, item.count === 0 && 'is-zero')}>
                  <span className="gm-attn__ico" aria-hidden="true">{item.icon}</span>
                  <span className="gm-attn__txt"><strong>{item.title}</strong><small>{item.sub}</small></span>
                  <span className="gm-attn__count">{item.count} {t('ta')}</span>
                  <ChevronRight size={16} aria-hidden="true" className="gm-attn__go" />
                </Link>
              ))}
            </div>
          </section>

          <div className="gm-kpis">
            {[
              { icon: <Users size={24} />, tone: 'blue', label: t('Faol foydalanuvchilar'), value: data.users.byStatus.ACTIVE ?? 0 },
              { icon: <Wrench size={24} />, tone: 'green', label: t('Faol ustalar'), value: data.masters.byStatus.ACTIVE ?? 0 },
              { icon: <ClipboardList size={24} />, tone: 'violet', label: t('Yangi so‘rovlar'), value: data.requests.total },
              { icon: <PackageCheck size={24} />, tone: 'teal', label: t('Buyurtmalar'), value: data.orders.total },
            ].map((kpi) => (
              <div key={kpi.label} className={`gm-kpi gm-kpi--${kpi.tone}`}>
                <span className="gm-kpi__icon" aria-hidden="true">{kpi.icon}</span>
                <div>
                  <span className="gm-kpi__label">{kpi.label}</span>
                  <strong className="gm-kpi__value">{kpi.value}</strong>
                  <span className="gm-kpi__note">{periodNote}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="gm-dgrid gm-dgrid--chart">
            <Panel
              title={t('Buyurtmalar dinamikasi')}
              badge={
                <div className="gm-seg" role="tablist" aria-label={t('Davr')}>
                  {([7, 30, 90] as const).map((value) => (
                    <button key={value} type="button" role="tab" aria-selected={days === value} className={cx(days === value && 'is-on')} onClick={() => setDays(value)}>
                      {value} {t('kun')}
                    </button>
                  ))}
                </div>
              }
            >
              {series.data ? <OrdersChart series={series.data} compact /> : <div className="gm-dpanel__empty">{series.isError ? getErrorMessage(series.error) : t('Yuklanmoqda…')}</div>}
            </Panel>

            <Panel title={t('Buyurtmalar holati')} action={{ to: '/admin/buyurtmalar', label: t('Barchasi') }}>
              {orderCounts.length === 0 ? (
                <div className="gm-dpanel__empty">{t('Ma’lumot yo‘q')}</div>
              ) : (
                <ul className="gm-ostat">
                  {orderCounts.slice(0, 6).map(([status, count]) => (
                    <li key={status} className={`gm-ostat__row gm-ostat__row--${toneOf(status)}`}>
                      <div>
                        <span><i aria-hidden="true" />{statusLabel(status)}</span>
                        <b>{count} <small>({Math.round((count / orderTotal) * 100)}%)</small></b>
                      </div>
                      <div className="gm-ostat__bar" aria-hidden="true"><span style={{ width: `${Math.max(4, (count / orderCounts[0]![1]) * 100)}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="gm-dgrid gm-dgrid--table">
            <Panel title={t('So‘nggi buyurtmalar')} action={{ to: '/admin/buyurtmalar', label: t('Barchasini ko‘rish') }}>
              {data.recentOrders.length === 0 ? (
                <div className="gm-dpanel__empty">{t('Hali buyurtma yo‘q')}</div>
              ) : (
                <div className="gm-otable" role="table">
                  <div className="gm-otable__row gm-otable__row--head" role="row">
                    <span>ID</span><span>{t('Mijoz')}</span><span>{t('Xizmat')}</span><span>{t('Usta')}</span><span>{t('Holat')}</span><span>{t('Sana')}</span><span aria-hidden="true" />
                  </div>
                  {data.recentOrders.slice(0, 4).map((order) => (
                    <Link key={order.id} to={`/admin/buyurtmalar/${order.id}`} className="gm-otable__row" role="row">
                      <span className="gm-otable__id">#{order.orderNumber}</span>
                      <span className="gm-otable__person" data-label={t('Mijoz')}><em aria-hidden="true">{accountName(order.customer).charAt(0)}</em><b>{accountName(order.customer)}</b></span>
                      <span data-label={t('Xizmat')} className="gm-otable__svc">{order.service}</span>
                      <span className="gm-otable__person" data-label={t('Usta')}><em aria-hidden="true">{accountName(order.master).charAt(0)}</em><b>{accountName(order.master)}</b></span>
                      <span data-label={t('Holat')}><span className={`gm-pill gm-pill--${toneOf(order.status)}`}><i aria-hidden="true" />{statusLabel(order.status)}</span></span>
                      <span className="gm-otable__date" data-label={t('Sana')}>{formatDateTime(order.createdAt)}</span>
                      <ChevronRight size={16} aria-hidden="true" className="gm-otable__go" />
                    </Link>
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title={t('Platforma holati')}
              badge={stable == null ? undefined : <Badge tone={stable ? 'success' : 'danger'}>{stable ? t('Barqaror') : t('Muammo bor')}</Badge>}
            >
              {!me.data?.isSuperAdmin ? (
                <div className="gm-dpanel__empty">{t('Faqat superadmin uchun')}</div>
              ) : devops.data ? (
                <ul className="gm-health">
                  {[
                    { label: 'API', ok: true, note: `${devops.data.process.rssMB} MB`, icon: <ShieldCheck size={18} /> },
                    { label: t('Ma’lumotlar bazasi'), ok: devops.data.dependencies.database.ok, note: devops.data.dependencies.database.latencyMs != null ? `${devops.data.dependencies.database.latencyMs} ms` : '—', icon: <Database size={18} /> },
                    { label: 'Redis', ok: devops.data.dependencies.redis.ok, note: devops.data.dependencies.redis.latencyMs != null ? `${devops.data.dependencies.redis.latencyMs} ms` : '—', icon: <Database size={18} /> },
                    ...devops.data.providers.map((p) => ({ label: p.label, ok: p.state !== 'OPEN', note: p.provider, icon: <ShieldCheck size={18} /> })),
                    { label: t('Zaxira nusxa'), ok: devops.data.backup.configured && !devops.data.backup.stale, note: devops.data.backup.ageHours != null ? t('{hours} soat oldin', { hours: devops.data.backup.ageHours }) : t('yo‘q'), icon: <Database size={18} /> },
                  ].map((row) => (
                    <li key={row.label}>
                      <span className="gm-health__ico" aria-hidden="true">{row.icon}</span>
                      <b>{row.label}</b>
                      <span className={cx('gm-health__state', row.ok ? 'is-ok' : 'is-bad')}><i aria-hidden="true" />{row.ok ? t('Ishlayapti') : t('Muammo')}</span>
                      <small>{row.note}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="gm-dpanel__empty">{devops.isError ? getErrorMessage(devops.error) : t('Yuklanmoqda…')}</div>
              )}
              <Link to="/admin/devops" className="gm-dpanel__link gm-dpanel__link--foot">{t('Tizim monitoringi')} <ArrowRight size={14} aria-hidden="true" /></Link>
            </Panel>
          </div>

          <Section title={t('Holatlar bo‘yicha')} hint={periodNote}>
            <div className="gm-scs">
              <StatusCard icon={<Users size={20} />} title={t('Foydalanuvchilar')} counts={data.users.byStatus} good="ACTIVE" accent="#2f6bff" />
              <StatusCard icon={<Wrench size={20} />} title={t('Ustalar')} counts={data.masters.byVerification} good="VERIFIED" accent="#10b981" />
              <StatusCard icon={<ClipboardList size={20} />} title={t('So‘rovlar')} counts={data.requests.byStatus} good="BOOKED" accent="#8b5cf6" />
              <StatusCard icon={<PackageCheck size={20} />} title={t('Buyurtmalar')} counts={data.orders.byStatus} good="COMPLETED" accent="#14b8a6" />
              <StatusCard icon={<Wallet size={20} />} title={t('To‘lovlar')} counts={data.payments.byStatus} good="SUCCEEDED" accent="#f59e0b" />
              <StatusCard icon={<Scale size={20} />} title={t('Nizolar')} counts={data.disputes.byStatus} good="RESOLVED" accent="#e5384f" />
            </div>
          </Section>

          <Panel className="gm-dsec" title={t('Bugun')} badge={<span className="gm-dsec__hint">{t('Bugungi 00:00 dan boshlab')}</span>} action={{ to: '/admin/hisobot', label: t('Hisobotlar') }}>
            <div className="gm-mini-grid gm-mini-grid--5">
              <MiniStat icon={<Users size={20} />} tone="blue" value={data.today.newUsers} label={t('Yangi foydalanuvchilar')} />
              <MiniStat icon={<ClipboardList size={20} />} tone="violet" value={data.today.newRequests} label={t('Yangi so‘rovlar')} />
              <MiniStat icon={<PackageCheck size={20} />} tone="teal" value={data.today.newOrders} label={t('Yangi buyurtmalar')} />
              <MiniStat icon={<CalendarCheck size={20} />} tone="green" value={data.today.completedOrders} label={t('Yakunlangan buyurtmalar')} />
              <MiniStat icon={<Wallet size={20} />} tone="amber" value={formatMoney(data.today.revenue)} label={t('Bugungi tushum')} long />
            </div>
          </Panel>

          <div className="gm-dgrid gm-dgrid--pair">
            <Panel className="gm-dsec" title={t('Obunalar')} badge={<span className="gm-dsec__hint">{t('Jami faol')}: <b>{data.subscriptions.activeTotal}</b> · {t('Tushum')}: <b>{formatMoney(data.subscriptions.revenueTotal)}</b></span>} action={{ to: '/admin/obunalar', label: t('Barchasi') }}>
              <div className="gm-subs">
                <SubscriptionCard kind="customer" title={t('Mijoz obunasi')} stats={data.subscriptions.customer} />
                <SubscriptionCard kind="master" title={t('Usta obunasi')} stats={data.subscriptions.master} />
              </div>
            </Panel>

            <Panel className="gm-dsec" title={t('Ish lentasi')} badge={<span className="gm-dsec__hint">{t('Hozirgi holat')}</span>}>
              <div className="gm-mini-grid gm-mini-grid--feed">
                <MiniStat icon={<Clapperboard size={20} />} tone="violet" value={data.feed.posts} label={t('Lentadagi ishlar')} />
                <MiniStat icon={<Eye size={20} />} tone="blue" value={data.feed.views} label={t('Ko‘rishlar')} />
                <MiniStat icon={<Heart size={20} />} tone="red" value={data.feed.likes} label={t('Yoqtirishlar')} />
                <MiniStat icon={<MessageCircle size={20} />} tone="teal" value={data.feed.comments} label={t('Izohlar')} />
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
