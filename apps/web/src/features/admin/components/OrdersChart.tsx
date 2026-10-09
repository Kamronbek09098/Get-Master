import { useState } from 'react';
import { cx } from '@/lib/utils';
import type { OrdersSeries } from '../types';
import { t } from '@/i18n';

const W = 900;
const H_FULL = 250;
const H_COMPACT = 190;
const PAD = { top: 14, right: 16, bottom: 30, left: 34 };

/** Silliq (Catmull-Rom → Bezier) chiziq. */
function smooth(points: Array<[number, number]>, floor = Infinity, ceil = -Infinity): string {
  if (points.length < 2) return '';
  let d = `M${points[0]![0]},${points[0]![1]}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    const clamp = (v: number) => Math.min(floor, Math.max(ceil, v));
    d += ` C${c1x},${clamp(c1y)} ${c2x},${clamp(c2y)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

const niceMax = (value: number) => {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
};

/** «2026-10-09» → «9.10» (brauzer vaqt mintaqasiga bog‘liq emas). */
const dayLabel = (day: string) => {
  const [, month, date] = day.split('-').map(Number);
  return `${date}.${String(month).padStart(2, '0')}`;
};

/** Buyurtmalar dinamikasi: yaratilgan (ko‘k, to‘ldirilgan) va yakunlangan (yashil) buyurtmalar, kunma-kun. */
export function OrdersChart({ series, compact = false }: { series: OrdersSeries; compact?: boolean }) {
  const H = compact ? H_COMPACT : H_FULL;
  const [hover, setHover] = useState<number | null>(null);
  const { points } = series;
  const max = niceMax(Math.max(1, ...points.map((p) => Math.max(p.created, p.completed))));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const created = points.map((p, i) => [x(i), y(p.created)] as [number, number]);
  const completed = points.map((p, i) => [x(i), y(p.completed)] as [number, number]);
  const floor = PAD.top + innerH;
  const line = smooth(created, floor, PAD.top);
  const area = created.length > 1 ? `${line} L${x(points.length - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z` : '';
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const step = Math.max(1, Math.ceil(points.length / 8));
  const active = hover != null ? points[hover] : null;

  return (
    <div className="gm-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Buyurtmalar dinamikasi')} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="gm-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="gm-chart__grid" x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
            <text className="gm-chart__axis" x={PAD.left - 8} y={y(tick) + 4} textAnchor="end">{tick}</text>
          </g>
        ))}
        {points.map((p, i) => (i % step === 0 || i === points.length - 1 ? (
          <text key={p.date} className="gm-chart__axis" x={x(i)} y={H - 8} textAnchor="middle">{dayLabel(p.date)}</text>
        ) : null))}
        {area && <path className="gm-chart__area" d={area} fill="url(#gm-chart-fill)" />}
        <path className="gm-chart__line gm-chart__line--done" d={smooth(completed, floor, PAD.top)} />
        <path className="gm-chart__line" d={line} />
        {points.length <= 31 && created.map(([cx0, cy0], i) => <circle key={points[i]!.date} className="gm-chart__dot" cx={cx0} cy={cy0} r={hover === i ? 5 : 3} />)}
        {hover != null && <line className="gm-chart__cursor" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} />}
        {points.map((p, i) => (
          <rect key={p.date} x={x(i) - innerW / points.length / 2} y={PAD.top} width={innerW / points.length} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} />
        ))}
      </svg>
      {active && (
        <div className={cx('gm-chart__tip', hover! > points.length / 2 && 'gm-chart__tip--left')} style={{ left: `${(x(hover!) / W) * 100}%` }}>
          <strong>{dayLabel(active.date)}</strong>
          <span><i /> {t('Yangi')}: {active.created}</span>
          <span><i className="gm-chart__tip-done" /> {t('Yakunlangan')}: {active.completed}</span>
        </div>
      )}
      <div className="gm-chart__legend">
        <span><i /> {t('Yangi buyurtmalar')}</span>
        <span><i className="gm-chart__tip-done" /> {t('Yakunlangan buyurtmalar')}</span>
      </div>
    </div>
  );
}
