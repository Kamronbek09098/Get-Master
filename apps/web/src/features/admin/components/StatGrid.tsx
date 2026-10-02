import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '@/lib/utils';
import { statusLabel } from '@/lib/labels';
import { t } from '@/i18n';

export function StatGrid({ items }: { items: Array<{ label: string; value: string | number; icon?: ReactNode; to?: string }> }) {
  return (
    <div className="gm-stat-grid">
      {items.map((item) => {
        const content = (
          <>
            {item.icon && (
              <span className="gm-stat__icon" aria-hidden="true">
                {item.icon}
              </span>
            )}
            <span className="gm-stat__value">{item.value}</span>
            <span className="gm-stat__label">{item.label}</span>
          </>
        );
        return item.to ? (
          <Link key={item.label} to={item.to} className="gm-stat gm-stat--clickable">
            {content}
          </Link>
        ) : (
          <div key={item.label} className="gm-stat">
            {content}
          </div>
        );
      })}
    </div>
  );
}

interface CountValue {
  count: number;
  amount?: string | number;
}

function toCount(value: unknown): CountValue {
  if (typeof value === 'number') return { count: value };
  if (typeof value === 'object' && value !== null) {
    const { count, amount } = value as { count?: unknown; amount?: unknown };
    return { count: Number(count ?? 0), amount: amount === undefined ? undefined : (amount as string | number) };
  }
  return { count: Number(value ?? 0) };
}

export function CountList({ title, counts }: { title: string; counts: Record<string, unknown> }) {
  const entries = Object.entries(counts).map(([key, value]) => [key, toCount(value)] as const);
  const max = Math.max(1, ...entries.map(([, value]) => value.count));

  return (
    <div className="gm-count-card">
      <h3>{title}</h3>
      {entries.length === 0 ? (
        <p className="gm-card__meta">{t('Ma’lumot yo‘q')}</p>
      ) : (
        <ul className="gm-count-list">
          {entries.map(([key, value]) => (
            <li key={key}>
              <div className="gm-count-list__row">
                <span>{statusLabel(key)}</span>
                <strong>
                  {value.count}
                  {value.amount !== undefined && Number(value.amount) > 0 && (
                    <small> · {formatMoney(value.amount)}</small>
                  )}
                </strong>
              </div>
              <div className="gm-count-list__bar">
                <span style={{ width: `${Math.max(6, (value.count / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
