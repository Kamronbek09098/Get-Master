import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function ProfileCard({
  icon: Icon,
  title,
  hint,
  children,
  id,
  highlight = false,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: ReactNode;
  id?: string;
  highlight?: boolean;
}) {
  return (
    <section className={highlight ? 'gm-pcard gm-pcard--highlight' : 'gm-pcard'} id={id}>
      <header className="gm-pcard__head">
        <span className="gm-pcard__icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <div>
          <h2>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

export function InfoRows({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="gm-inforows">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
