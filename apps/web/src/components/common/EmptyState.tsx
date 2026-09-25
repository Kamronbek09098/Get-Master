import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import './EmptyState.css';

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="gm-empty-state">
      <span className="gm-empty-state__icon" aria-hidden="true">
        {icon ?? <Inbox size={28} strokeWidth={1.75} />}
      </span>
      <p className="gm-empty-state__title">{title}</p>
      {description && <p className="gm-empty-state__description">{description}</p>}
      {action}
    </div>
  );
}
