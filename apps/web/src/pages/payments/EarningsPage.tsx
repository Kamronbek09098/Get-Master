import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Banknote, CalendarDays, ChevronDown, ChevronUp, Clock, Minus, TrendingUp, Trophy, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDateTime, formatMoney } from '@/lib/utils';
import { useEarnings, useEarningsOverview } from '@/features/payment/hooks/usePayment';
import { PaymentStatus } from '@/features/payment/components/PaymentStatus';
import { providerLabel } from '@/features/payment/labels';
import type { EarningsDay } from '@/features/payment/types';
import './Earnings.css';

const RANGES = [7, 30, 90] as const;
const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
const WEEKDAYS = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];

const shortDate = (key: string) => `${Number(key.slice(8))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;
const weekday = (key: string) => WEEKDAYS[new Date(`${key}T00:00:00Z`).getUTCDay()];
const compact = (value: number) => (value >= 1_000_000 ? `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)} mln` : value >= 1_000 ? `${Math.round(value / 1_000)} ming` : String(Math.round(value)));

function Kpi({ icon, label, value, note, tone }: { icon: ReactNode; label: string; value: string; note?: string; tone?: 'warn' }) {
  return (
    <div className={cx('gm-earn__kpi', tone === 'warn' && 'gm-earn__kpi--warn')}>
      <span className="gm-earn__kpi-icon" aria-hidden="true">
        {icon}
      </span>
      <small>{label}</small>
      <strong>{value}</strong>
      {note && <em>{note}</em>}
    </div>
  );
}

function Collapse({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="gm-earn__collapse">
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>
          <strong>{title}</strong>
          <small>{hint}</small>
        </span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && <div className="gm-earn__collapse-body">{children}</div>}
    </section>
  );
}

function Chart({ daily, currency }: { daily: EarningsDay[]; currency: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...daily.map((day) => day.net), 1);
  const count = daily.length;
  const shown = active !== null ? daily[active] : null;
  const tickEvery = count <= 7 ? 1 : count <= 31 ? 5 : 15;
  const pct = (value: number) => `${Math.min(100, (value / max) * 100)}%`;
  const bestIndex = daily.reduce((best, day, index) => (day.net > (daily[best]?.net ?? 0) ? index : best), 0);
  const left = active !== null ? ((active + 0.5) / count) * 100 : 0;

  return (
    <div className="gm-chart">
      <div className="gm-chart__plot">
        <div className="gm-chart__y" aria-hidden="true">
          <span style={{ bottom: '100%' }}>{compact(max)}</span>
          <span style={{ bottom: '50%' }}>{compact(max / 2)}</span>
          <span style={{ bottom: '0%' }}>0</span>
        </div>
        <div className="gm-chart__area" onMouseLeave={() => setActive(null)}>
          <span className="gm-chart__grid" style={{ bottom: '100%' }} aria-hidden="true" />
          <span className="gm-chart__grid" style={{ bottom: '50%' }} aria-hidden="true" />
          <span className="gm-chart__grid gm-chart__grid--base" style={{ bottom: '0%' }} aria-hidden="true" />
          <div className="gm-chart__bars" role="list" aria-label="Kunlik daromad grafigi">
            {daily.map((day, index) => (
              <button
                key={day.date}
                type="button"
                role="listitem"
                className={cx('gm-chart__col', active === index && 'gm-chart__col--on')}
                aria-label={`${shortDate(day.date)}, ${weekday(day.date)}: ${formatMoney(day.net, currency)}, ${day.count} ta to‘lov`}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(active === index ? null : index)}
              >
                <span
                  className={cx('gm-chart__bar', day.net === 0 && 'gm-chart__bar--zero', index === count - 1 && 'gm-chart__bar--today', index === bestIndex && day.net > 0 && 'gm-chart__bar--best')}
                  style={{ height: day.net > 0 ? `max(${pct(day.net)}, 4px)` : '2px' }}
                />
              </button>
            ))}
          </div>
          {shown && (
            <div className="gm-chart__tip" style={{ left: `clamp(70px, ${left}%, calc(100% - 70px))` }} role="status">
              <strong>{formatMoney(shown.net, currency)}</strong>
              <span>
                {shortDate(shown.date)}, {weekday(shown.date)}
              </span>
              <span>{shown.count > 0 ? `${shown.count} ta to‘lov` : 'To‘lov bo‘lmagan'}</span>
            </div>
          )}
          <div className="gm-chart__x" aria-hidden="true">
            {daily.map((day, index) => {
              const isLast = index === count - 1;
              const show = isLast || (index % tickEvery === 0 && count - 1 - index >= Math.ceil(tickEvery / 2));
              return <span key={day.date}>{show ? <em>{isLast ? 'Bugun' : shortDate(day.date)}</em> : null}</span>;
            })}
          </div>
        </div>
      </div>
      <p className="gm-chart__hint">Kunni ko‘rish uchun ustuniga bosing yoki ustiga boring</p>
    </div>
  );
}

export function EarningsPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const overview = useEarningsOverview(days);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const history = useEarnings({
    dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
    dateTo: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
  });
  const data = overview.data;

  const delta = useMemo(() => {
    if (!data) return null;
    const { net, yesterday } = data.today;
    if (yesterday === 0 && net === 0) return null;
    if (yesterday === 0) return { tone: 'up' as const, text: 'Kecha daromad bo‘lmagan' };
    const percent = Math.round(((net - yesterday) / yesterday) * 100);
    return { tone: percent > 0 ? ('up' as const) : percent < 0 ? ('down' as const) : ('flat' as const), text: `${percent > 0 ? '+' : ''}${percent}% kechagiga nisbatan` };
  }, [data]);
  const providerTotal = data?.providers.reduce((sum, item) => sum + item.net, 0) ?? 0;

  return (
    <div className="gm-earn">
      <div className="gm-page-header">
        <div>
          <h1>Daromad</h1>
          <p className="gm-page-lead">Bugungi daromadingiz, kunlik dinamika va to‘lovlar bir joyda.</p>
        </div>
        <div className="gm-earn__ranges" role="group" aria-label="Grafik davri">
          {RANGES.map((value) => (
            <button key={value} type="button" aria-pressed={days === value} className={cx('gm-otab', days === value && 'gm-otab--active')} onClick={() => setDays(value)}>
              {value} kun
            </button>
          ))}
        </div>
      </div>

      {overview.isLoading && <PageLoader label="Daromad yuklanmoqda…" />}
      {overview.isError && <Alert tone="danger">{getErrorMessage(overview.error)}</Alert>}

      {data && (
        <>
          <section className="gm-earn__hero" aria-label="Bugungi daromad">
            <div className="gm-earn__hero-main">
              <span className="gm-earn__hero-label">
                <CalendarDays size={16} aria-hidden="true" /> Bugungi daromad · {shortDate(data.today.date)}
              </span>
              <strong className="gm-earn__hero-value">{formatMoney(data.today.net, data.currency)}</strong>
              <span className="gm-earn__hero-sub">
                {data.today.count > 0 ? `${data.today.count} ta to‘lov qabul qilindi` : 'Bugun hali to‘lov qabul qilinmagan'}
              </span>
              {delta && (
                <span className={cx('gm-earn__delta', `gm-earn__delta--${delta.tone}`)}>
                  {delta.tone === 'up' ? <ArrowUpRight size={14} /> : delta.tone === 'down' ? <ArrowDownRight size={14} /> : <Minus size={14} />} {delta.text}
                </span>
              )}
            </div>
            <div className="gm-earn__hero-side">
              <div>
                <small>Kecha</small>
                <strong>{formatMoney(data.today.yesterday, data.currency)}</strong>
              </div>
              <div>
                <small>Kunlik o‘rtacha ({days} kun)</small>
                <strong>{formatMoney(data.range.average, data.currency)}</strong>
              </div>
            </div>
          </section>

          <section className="gm-earn__kpis" aria-label="Umumiy ko‘rsatkichlar">
            <Kpi icon={<TrendingUp size={18} />} label="Shu hafta" value={formatMoney(data.week.net, data.currency)} note={`${data.week.count} ta to‘lov`} />
            <Kpi icon={<CalendarDays size={18} />} label="Shu oy" value={formatMoney(data.month.net, data.currency)} note={`${data.month.count} ta to‘lov`} />
            <Kpi icon={<Wallet size={18} />} label="Jami daromad" value={formatMoney(data.all.net, data.currency)} note={`${data.all.count} ta to‘lov`} />
            <Kpi
              icon={<Clock size={18} />}
              label="Kutilayotgan to‘lovlar"
              value={formatMoney(data.pending.amount, data.currency)}
              note={data.pending.count > 0 ? `${data.pending.count} ta hali tasdiqlanmagan` : 'Kutilayotgani yo‘q'}
              tone={data.pending.count > 0 ? 'warn' : undefined}
            />
          </section>

          <section className="gm-earn__panel">
            <header>
              <h2>Kunlik daromad</h2>
              <span>
                Oxirgi {days} kun: <strong>{formatMoney(data.range.net, data.currency)}</strong>
              </span>
            </header>
            <Chart daily={data.daily} currency={data.currency} />
            <div className="gm-earn__facts">
              <div>
                <Trophy size={16} aria-hidden="true" />
                <span>
                  Eng yaxshi kun: <strong>{data.range.bestDay ? `${shortDate(data.range.bestDay.date)} · ${formatMoney(data.range.bestDay.net, data.currency)}` : '—'}</strong>
                </span>
              </div>
              <div>
                <Banknote size={16} aria-hidden="true" />
                <span>
                  Kunlik o‘rtacha: <strong>{formatMoney(data.range.average, data.currency)}</strong>
                </span>
              </div>
            </div>
          </section>

          {data.providers.length > 0 && (
            <section className="gm-earn__panel">
              <header>
                <h2>To‘lov usullari</h2>
                <span>Oxirgi {days} kun</span>
              </header>
              <ul className="gm-earn__methods">
                {data.providers.map((item) => (
                  <li key={item.provider}>
                    <span>{providerLabel(item.provider)}</span>
                    <div className="gm-earn__track">
                      <span style={{ width: `${providerTotal > 0 ? Math.round((item.net / providerTotal) * 100) : 0}%` }} />
                    </div>
                    <strong>{formatMoney(item.net, data.currency)}</strong>
                    <small>{item.count} ta</small>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Collapse title="Kunlar bo‘yicha jadval" hint="Har kunning daromadi va to‘lovlar soni">
            <table className="gm-earn__table">
              <thead>
                <tr>
                  <th>Sana</th>
                  <th>To‘lovlar</th>
                  <th>Daromad</th>
                </tr>
              </thead>
              <tbody>
                {[...data.daily]
                  .reverse()
                  .filter((day) => day.count > 0)
                  .map((day) => (
                    <tr key={day.date}>
                      <td>
                        {shortDate(day.date)} <small>{weekday(day.date)}</small>
                      </td>
                      <td>{day.count} ta</td>
                      <td>
                        <strong>{formatMoney(day.net, data.currency)}</strong>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {data.daily.every((day) => day.count === 0) && <EmptyState title="Bu davrda daromad yo‘q" />}
          </Collapse>

          <Collapse title="To‘lovlar tarixi" hint="Sana bo‘yicha saralash va har bir to‘lov">
            <div className="gm-toolbar">
              <Input label="Boshlanish sanasi" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} />
              <Input label="Tugash sanasi" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} />
            </div>
            {history.isLoading && <PageLoader label="To‘lovlar yuklanmoqda…" />}
            {history.isError && <Alert tone="danger">{getErrorMessage(history.error)}</Alert>}
            {history.data && (
              <>
                <p className="gm-earn__summary">
                  Tanlangan davrda: sof <strong>{formatMoney(history.data.summary.netAmount, data.currency)}</strong> · jami tushum {formatMoney(history.data.summary.grossAmount, data.currency)} · qaytarilgan{' '}
                  {formatMoney(history.data.summary.refundedAmount, data.currency)} · {history.data.summary.paymentCount} ta to‘lov
                </p>
                {history.data.items.length === 0 && <EmptyState title="Bu davrda to‘lovlar yo‘q" />}
                <div className="gm-list">
                  {history.data.items.map((payment) => (
                    <div key={payment.id} className="gm-card">
                      <PaymentStatus payment={payment} />
                      <p className="gm-card__meta">
                        {providerLabel(payment.provider)} · {formatDateTime(payment.succeededAt ?? payment.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Collapse>
        </>
      )}
    </div>
  );
}
