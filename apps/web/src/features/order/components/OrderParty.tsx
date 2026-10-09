import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { accountName } from '@/lib/account-name';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { Button } from '@/components/ui/Button';
import { formatDateTime, formatMoney } from '@/lib/utils';
import type { OrderDetailsData } from '../types';
import { t } from '@/i18n';

export function OrderParty({ order }: { order: OrderDetailsData }) {
  const name = accountName(order.counterpart);
  const base = order.viewerRole === 'MASTER' ? '/usta' : '/mijoz';
  const role = order.viewerRole === 'MASTER' ? 'Mijoz' : 'Usta';

  return (
    <aside className="gm-ocard gm-oparty" aria-label={t('Buyurtma ma’lumotlari')}>
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
            <MessageCircle size={16} />{' '}{t('Chat orqali yozish')}</Button>
        </Link>
      )}
      <dl className="gm-oparty__facts">
        {order.service && (
          <div>
            <dt>{t('Xizmat')}</dt>
            <dd>{order.service.name}</dd>
          </div>
        )}
        <div>
          <dt>{t('Kelishilgan narx')}</dt>
          <dd className="gm-oparty__money">{formatMoney(order.originalAmount, order.currency)}</dd>
        </div>
        {Number(order.additionalAmount) > 0 && (
          <div>
            <dt>{t('Qo‘shimcha ishlar')}</dt>
            <dd className="gm-oparty__money">+{formatMoney(order.additionalAmount, order.currency)}</dd>
          </div>
        )}
        <div className="gm-oparty__sum">
          <dt>{t('Jami')}</dt>
          <dd className="gm-oparty__money gm-oparty__total">{formatMoney(order.finalAmount, order.currency)}</dd>
        </div>
        {order.scheduledStartAt && (
          <div>
            <dt>{t('Boshlanish vaqti')}</dt>
            <dd className="gm-oparty__date">{formatDateTime(order.scheduledStartAt)}</dd>
          </div>
        )}
        <div>
          <dt>{t('Yaratildi')}</dt>
          <dd className="gm-oparty__date">{formatDateTime(order.createdAt)}</dd>
        </div>
      </dl>
    </aside>
  );
}
