import { cx, formatDateTime } from '@/lib/utils';
import { ACTOR_TEXT, STATUS_TEXT } from '../order-flow';
import { useOrderTimeline } from '../hooks/useOrders';

export function OrderTimeline({ orderId }: { orderId: string }) {
  const timeline = useOrderTimeline(orderId);
  const items = [...(timeline.data ?? [])].reverse();
  if (items.length === 0) return null;

  return (
    <section className="gm-ocard" aria-label="Tarix">
      <h2 className="gm-ocard__title">Buyurtma tarixi</h2>
      <ol className="gm-otimeline">
        {items.map((entry, index) => (
          <li key={entry.id} className={cx('gm-otimeline__item', index === 0 && 'gm-otimeline__item--latest')}>
            <span className="gm-otimeline__dot" aria-hidden="true" />
            <div>
              <strong>{STATUS_TEXT[entry.newStatus]}</strong>
              <small>
                {ACTOR_TEXT[entry.actorType]} · {formatDateTime(entry.createdAt)}
              </small>
              {entry.reason && entry.reason !== 'Offer accepted' && <p>“{entry.reason}”</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
