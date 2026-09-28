import { useMemo, useState } from 'react';
import { formatDateTime } from '@/lib/utils';
import type { DevOpsSnapshot, DevOpsWindow } from '../types';
import './TrafficChart.css';

const WIDTH = 760;
const HEIGHT = 160;
const PAD_LEFT = 4;
const PAD_RIGHT = 4;
const PAD_TOP = 8;
const PAD_BOTTOM = 22;
const GAP = 2;

function bucketLabel(at: string, window: DevOpsWindow): string {
  const date = new Date(at);
  if (window === '1h') return date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  if (window === '24h') return date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' });
}

export function TrafficChart({ data, window }: { data: DevOpsSnapshot['traffic']; window: DevOpsWindow }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = useMemo(() => Math.max(1, ...data.map((point) => point.count)), [data]);
  const total = useMemo(() => data.reduce((sum, point) => sum + point.count, 0), [data]);

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const barWidth = data.length > 0 ? plotWidth / data.length - GAP : 0;

  if (total === 0) {
    return (
      <div className="gm-traffic-chart gm-traffic-chart--empty">
        <p className="gm-card__meta">Bu davrda hali so‘rov qayd etilmagan.</p>
      </div>
    );
  }

  return (
    <div className="gm-traffic-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="API so‘rovlar soni vaqt bo‘yicha" preserveAspectRatio="none">
        <line
          x1={PAD_LEFT}
          y1={PAD_TOP + plotHeight}
          x2={WIDTH - PAD_RIGHT}
          y2={PAD_TOP + plotHeight}
          className="gm-traffic-chart__axis"
        />
        {data.map((point, index) => {
          const x = PAD_LEFT + index * (barWidth + GAP);
          const barHeight = point.count === 0 ? 0 : Math.max(2, (point.count / max) * plotHeight);
          const y = PAD_TOP + plotHeight - barHeight;
          const isHovered = hover === index;
          return (
            <g key={point.at} onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)}>
              <rect x={x} y={PAD_TOP} width={Math.max(barWidth, 1)} height={plotHeight} fill="transparent" />
              {barHeight > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={Math.max(barWidth, 1)}
                  height={barHeight}
                  rx={Math.min(3, barWidth / 2)}
                  className={isHovered ? 'gm-traffic-chart__bar gm-traffic-chart__bar--hover' : 'gm-traffic-chart__bar'}
                />
              )}
              <title>
                {bucketLabel(point.at, window)} · {point.count} ta so‘rov
              </title>
            </g>
          );
        })}
      </svg>
      <div className="gm-traffic-chart__footer">
        <span>{bucketLabel(data[0]!.at, window)}</span>
        <span className="gm-card__meta">Jami: {total} ta so‘rov</span>
        <span>{bucketLabel(data[data.length - 1]!.at, window)}</span>
      </div>
      <p className="gm-card__meta gm-traffic-chart__hover">
        {hover !== null ? `${formatDateTime(data[hover]!.at)} — ${data[hover]!.count} ta so‘rov` : ' '}
      </p>
    </div>
  );
}
