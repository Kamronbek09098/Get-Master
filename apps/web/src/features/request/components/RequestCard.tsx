import { Link } from 'react-router-dom';
import { ChevronRight, Clock, Users } from 'lucide-react';
import { categoryIcon } from '@/features/service/category-icon';
import { formatRelativeTime } from '@/lib/utils';
import { RequestStatus } from './RequestStatus';
import type { ProblemRequestSummary } from '../types';
import './RequestCard.css';

export function RequestCard({ request }: { request: ProblemRequestSummary }) {
  const serviceName = request.service?.name;
  const Icon = categoryIcon(serviceName ?? request.title);
  const offers = request.offersCount ?? 0;

  return (
    <Link to={`/mijozlar/sorovlar/${request.id}`} className="gm-request-card">
      <span className="gm-request-card__icon" aria-hidden="true">
        <Icon size={22} strokeWidth={1.9} />
      </span>
      <div className="gm-request-card__body">
        <div className="gm-request-card__header">
          <h3>{request.title}</h3>
          <RequestStatus status={request.status} />
        </div>
        {serviceName && <p className="gm-request-card__service">{serviceName}</p>}
        <p className="gm-request-card__description">{request.description}</p>
        <div className="gm-request-card__foot">
          <span>
            <Clock size={14} aria-hidden="true" /> {formatRelativeTime(request.createdAt)}
          </span>
          {offers > 0 && (
            <span className="gm-request-card__offers">
              <Users size={14} aria-hidden="true" /> {offers} ta taklif
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={20} className="gm-request-card__go" aria-hidden="true" />
    </Link>
  );
}
