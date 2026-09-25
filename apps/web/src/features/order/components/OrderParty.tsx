import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { accountName } from '@/lib/account-name';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { Button } from '@/components/ui/Button';
import { formatDateTime, formatMoney } from '@/lib/utils';
import type { OrderDetailsData } from '../types';

export function OrderParty({ order }: { order: OrderDetailsData }) {
  const name = accountName(order.counterpart);
  const base = order.viewerRole === 'MASTER' ? '/ustalar' : '/mijozlar';
  const role = order.viewerRole === 'MASTER' ? 'Mijoz' : 'Usta';

  return (
    <aside className="gm-ocard gm-oparty" aria-label="Buyurtma ma’lumotlari">
      <div className="gm-oparty__who">
        <ChatAvatar name={name} seed={order.counterpart.id} size="lg" />
        <div>
          <small>{role}</small>
          <strong>{name}</strong>
          {order.counterpart.accountNumber !== undefined && <span>ID {order.counterpart.accountNumber}</span>}
          {order.counterpart.profession && <span>{order.counterpart.profession}</span>}
        </div>
      </div>
      {order.conversationId && (
        <Link to={`${base}/chat?suhbat=${order.conversationId}`}>
          <Button variant="secondary" fullWidth>
            <MessageCircle size={16} /> Chat orqali yozish
          </Button>
        </Link>
      )}
      <dl className="gm-oparty__facts">
        {order.service && (
          <>
            <dt>Xizmat</dt>
            <dd>{order.service.name}</dd>
          </>
        )}
        <dt>Kelishilgan narx</dt>
        <dd>{formatMoney(order.originalAmount, order.currency)}</dd>
        {Number(order.additionalAmount) > 0 && (
          <>
            <dt>Qo‘shimcha ishlar</dt>
            <dd>+ {formatMoney(order.additionalAmount, order.currency)}</dd>
          </>
        )}
        <dt>Jami</dt>
        <dd className="gm-oparty__total">{formatMoney(order.finalAmount, order.currency)}</dd>
        {order.scheduledStartAt && (
          <>
            <dt>Boshlanish vaqti</dt>
            <dd>{formatDateTime(order.scheduledStartAt)}</dd>
          </>
        )}
        <dt>Yaratildi</dt>
        <dd>{formatDateTime(order.createdAt)}</dd>
      </dl>
    </aside>
  );
}
