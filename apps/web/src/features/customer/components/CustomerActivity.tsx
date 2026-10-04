import { Link } from 'react-router-dom';
import { ChevronRight, History, Package, Users } from 'lucide-react';
import { ProfileCard } from '@/features/profile/ProfileCard';
import { ACTIVE_STATUSES } from '@/features/order/order-flow';
import { FLOW_STEPS, STATUS_TEXT, stepIndex } from '@/features/order/order-flow';
import type { OrderListItem } from '@/features/order/types';
import { accountName } from '@/lib/account-name';
import { formatDate, formatMoney } from '@/lib/utils';
import { t } from '@/i18n';
import './CustomerActivity.css';

/** Mijoz profili: faol buyurtmalar, tarix va birga ishlagan ustalar — mavjud buyurtmalar ma’lumotidan (yangi so‘rov yo‘q). */
export function CustomerActivity({ orders }: { orders: OrderListItem[] }) {
  const active = orders.filter((order) => ACTIVE_STATUSES.includes(order.status));
  const history = orders.filter((order) => order.status === 'COMPLETED' || order.status === 'CANCELLED').slice(0, 5);

  const masters = new Map<string, { key: string; name: string; profession: string | null | undefined; jobs: number }>();
  orders
    .filter((order) => order.status === 'COMPLETED')
    .forEach((order) => {
      const key = String(order.counterpart.accountNumber ?? order.counterpart.id);
      const known = masters.get(key);
      if (known) known.jobs += 1;
      else masters.set(key, { key, name: accountName(order.counterpart), profession: order.counterpart.profession, jobs: 1 });
    });

  return (
    <>
      <ProfileCard defaultOpen icon={Package} title={t('Faol buyurtmalar')} hint={t('Hozir davom etayotgan ishlar.')}>
        {active.length === 0 ? (
          <p className="gm-pempty">{t('Hozir faol buyurtma yo‘q.')}</p>
        ) : (
          <ul className="gm-act">
            {active.map((order) => {
              const index = Math.max(0, stepIndex(order.status));
              return (
                <li key={order.id}>
                  <Link to={`/mijozlar/buyurtmalar/${order.id}`} className="gm-act__item">
                    <span className="gm-act__top">
                      <strong>{order.title}</strong>
                      <ChevronRight size={16} aria-hidden="true" />
                    </span>
                    <span className="gm-act__sub">
                      {accountName(order.counterpart)} · {STATUS_TEXT[order.status]}
                    </span>
                    <span
                      className="gm-act__bar"
                      role="img"
                      aria-label={`${index + 1} / ${FLOW_STEPS.length}`}
                      style={{ ['--done' as string]: (index + 1) / FLOW_STEPS.length }}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </ProfileCard>

      <ProfileCard icon={Users} title={t('Birga ishlagan ustalar')} hint={t('Yakunlangan buyurtmalar asosida.')}>
        {masters.size === 0 ? (
          <p className="gm-pempty">{t('Hali yakunlangan buyurtma yo‘q.')}</p>
        ) : (
          <ul className="gm-act">
            {[...masters.values()].map((master) => (
              <li key={master.key}>
                <Link to={`/ustalar-katalogi/${master.key}`} className="gm-act__item">
                  <span className="gm-act__top">
                    <strong>{master.name}</strong>
                    <ChevronRight size={16} aria-hidden="true" />
                  </span>
                  <span className="gm-act__sub">
                    {master.profession ?? t('Usta')} · {master.jobs} {t('ta ish')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ProfileCard>

      <ProfileCard icon={History} title={t('Buyurtmalar tarixi')}>
        {history.length === 0 ? (
          <p className="gm-pempty">{t('Tarix hozircha bo‘sh.')}</p>
        ) : (
          <ul className="gm-act">
            {history.map((order) => (
              <li key={order.id}>
                <Link to={`/mijozlar/buyurtmalar/${order.id}`} className="gm-act__item">
                  <span className="gm-act__top">
                    <strong>{order.title}</strong>
                    <span className="gm-act__amount">{formatMoney(order.finalAmount, order.currency)}</span>
                  </span>
                  <span className="gm-act__sub">
                    {STATUS_TEXT[order.status]} · {formatDate(order.completedAt ?? order.cancelledAt ?? order.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link to="/mijozlar/buyurtmalar" className="gm-plink">
          <span className="gm-plink__label">{t('Barcha buyurtmalar')}</span>
          <ChevronRight size={18} className="gm-plink__arrow" aria-hidden="true" />
        </Link>
      </ProfileCard>
    </>
  );
}
