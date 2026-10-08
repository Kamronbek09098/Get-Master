import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award, CalendarClock, MessageCircle, PackageCheck } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate, initials } from '@/lib/utils';
import { customerPublicService } from '@/features/customer/services/customer-public.service';
import { t } from '@/i18n';
import '../master/MasterProfile.css';

/** Usta ko‘radigan mijozning qisqa profili (chat sarlavhasidagi ism bosilganda): telefon va manzil ko‘rsatilmaydi. */
export function CustomerPublicPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const customer = useQuery({ queryKey: ['customer-public', id], queryFn: () => customerPublicService.get(id), retry: false });

  if (customer.isLoading) return <PageLoader label={t('Mijoz yuklanmoqda…')} />;
  if (customer.isError) return <Alert tone="danger">{getErrorMessage(customer.error)}</Alert>;
  if (!customer.data) return null;

  const data = customer.data;
  const name = accountName(data);
  return (
    <div className="gm-mp">
      <section className="gm-mp-hero" aria-labelledby="gm-cp-name">
        <span className="gm-mp-hero__avatar" aria-hidden="true">
          {initials(name)}
        </span>
        <div className="gm-mp-hero__who">
          <p className="gm-mp-hero__kicker">{t('Mijoz')}</p>
          <h1 id="gm-cp-name">{name}</h1>
          <div className="gm-mp-hero__badges">
            <span className="gm-mp-hero__place">ID {data.accountNumber}</span>
          </div>
        </div>
      </section>

      <section className="gm-mp-trust" aria-label={t('Mijoz ko‘rsatkichlari')}>
        <dl>
          <div>
            <dt>
              <Award size={15} aria-hidden="true" /> {t('Yakunlangan buyurtmalar')}
            </dt>
            <dd>{data.completedOrders}</dd>
          </div>
          <div>
            <dt>
              <PackageCheck size={15} aria-hidden="true" /> {t('Siz bilan buyurtmalar')}
            </dt>
            <dd>{data.ordersWithMe}</dd>
          </div>
          <div>
            <dt>
              <CalendarClock size={15} aria-hidden="true" /> {t('Platformada')}
            </dt>
            <dd>{formatDate(data.memberSince)}</dd>
          </div>
        </dl>
      </section>

      <div className="gm-mp-cta gm-action-row">
        <Button size="lg" onClick={() => navigate(`/usta/chat?suhbat=${data.conversationId}`)}>
          <MessageCircle size={20} />{' '}{t('Suhbatga o‘tish')}</Button>
      </div>
    </div>
  );
}
