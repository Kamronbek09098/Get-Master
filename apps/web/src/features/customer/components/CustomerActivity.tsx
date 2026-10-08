import { Link } from 'react-router-dom';
import { ChevronRight, Users } from 'lucide-react';
import { ProfileCard } from '@/features/profile/ProfileCard';
import type { OrderListItem } from '@/features/order/types';
import { accountName } from '@/lib/account-name';
import { formatDate } from '@/lib/utils';
import { t } from '@/i18n';
import './CustomerActivity.css';

interface WorkedMaster {
  key: string;
  name: string;
  profession: string | null | undefined;
  jobs: number;
  lastAt: string;
  available: boolean;
}

/** Mijoz profili: birga ishlagan ustalar — mavjud buyurtmalar ma’lumotidan (yangi so‘rov yo‘q). */
export function CustomerActivity({ orders }: { orders: OrderListItem[] }) {
  const byMaster = new Map<string, WorkedMaster>();
  for (const order of orders) {
    if (order.status !== 'COMPLETED') continue;
    const key = String(order.counterpart.accountNumber ?? order.counterpart.id);
    const at = order.createdAt;
    const known = byMaster.get(key);
    if (known) {
      known.jobs += 1;
      if (at > known.lastAt) known.lastAt = at;
    } else {
      byMaster.set(key, {
        key,
        name: accountName(order.counterpart),
        profession: order.counterpart.profession,
        jobs: 1,
        lastAt: at,
        // Eski javoblarda `available` bo‘lmasa, havola ochiq deb olinadi.
        available: order.counterpart.available !== false && order.counterpart.accountNumber != null,
      });
    }
  }
  const masters = [...byMaster.values()].sort((a, b) => b.jobs - a.jobs || (a.lastAt < b.lastAt ? 1 : -1));

  return (
    <ProfileCard icon={Users} title={t('Birga ishlagan ustalar')} hint={t('Yakunlangan buyurtmalar asosida')}>
      {masters.length === 0 ? (
        <p className="gm-pempty">{t('Hali yakunlangan buyurtma yo‘q.')}</p>
      ) : (
        <ul className="gm-act">
          {masters.map((master) => {
            const body = (
              <>
                <span className="gm-act__top">
                  <strong>{master.name}</strong>
                  {master.available ? <ChevronRight size={16} aria-hidden="true" /> : <span className="gm-act__off">{t('Hozir faol emas')}</span>}
                </span>
                <span className="gm-act__sub">
                  {master.profession ?? t('Usta')} · {master.jobs} {t('ta ish')} · {t('Oxirgisi: {date}', { date: formatDate(master.lastAt) })}
                </span>
              </>
            );
            return (
              <li key={master.key}>
                {master.available ? (
                  <Link to={`/mijoz/ustalar/${master.key}`} className="gm-act__item">
                    {body}
                  </Link>
                ) : (
                  <div className="gm-act__item gm-act__item--off">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </ProfileCard>
  );
}
