import { Link } from 'react-router-dom';
import { ChevronRight, Users } from 'lucide-react';
import { ProfileCard } from '@/features/profile/ProfileCard';
import type { OrderListItem } from '@/features/order/types';
import { accountName } from '@/lib/account-name';
import { t } from '@/i18n';
import './CustomerActivity.css';

/** Mijoz profili: birga ishlagan ustalar — mavjud buyurtmalar ma’lumotidan (yangi so‘rov yo‘q). */
export function CustomerActivity({ orders }: { orders: OrderListItem[] }) {

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
    </>
  );
}
