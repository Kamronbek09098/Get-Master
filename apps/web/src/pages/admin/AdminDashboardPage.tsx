import { useState } from 'react';
import { CalendarCheck, ClipboardList, PackageCheck, Scale, Star, UserRound, Users, Wrench } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { useDashboard } from '@/features/admin/hooks/useAdmin';
import { CountList, StatGrid } from '@/features/admin/components/StatGrid';
import { DateRangeFilter } from '@/features/admin/components/DateRangeFilter';
import { toRange } from '@/features/admin/range';
import { t } from '@/i18n';

export function AdminDashboardPage() {
  const [range, setRange] = useState({ from: '', to: '' });
  const dashboard = useDashboard(toRange(range));
  const data = dashboard.data;

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>{t('Boshqaruv paneli')}</h1>
          <p className="gm-page-lead">{t('Platforma bo‘yicha umumiy ko‘rsatkichlar')}</p>
        </div>
      </div>
      <DateRangeFilter value={range} onChange={setRange} />
      {dashboard.isLoading && <PageLoader label={t('Statistika yuklanmoqda…')} />}
      {dashboard.isError && <Alert tone="danger">{getErrorMessage(dashboard.error)}</Alert>}
      {data && (
        <>
          <StatGrid
            items={[
              { label: t('Foydalanuvchilar'), value: data.users.total, icon: <Users size={20} />, to: '/admin/foydalanuvchilar' },
              { label: t('Ustalar'), value: data.masters.total, icon: <Wrench size={20} />, to: '/admin/foydalanuvchilar?role=MASTER' },
              { label: t('So‘rovlar'), value: data.requests.total, icon: <ClipboardList size={20} /> },
              { label: t('Bronlar'), value: data.bookings.total, icon: <CalendarCheck size={20} /> },
              { label: t('Buyurtmalar'), value: data.orders.total, icon: <PackageCheck size={20} />, to: '/admin/buyurtmalar' },
              { label: t('Nizolar'), value: data.disputes.total, icon: <Scale size={20} />, to: '/admin/shikoyatlar?kind=disputes' },
              { label: t('Sharhlar'), value: data.reviews.total, icon: <UserRound size={20} /> },
              { label: t('O‘rtacha baho'), value: Number(data.reviews.averageRating).toFixed(2), icon: <Star size={20} /> },
            ]}
          />
          <h2 style={{ margin: 'var(--gm-space-6) 0 var(--gm-space-4)' }}>{t('Holatlar bo‘yicha')}</h2>
          <section>
            <div className="gm-count-grid">
              <CountList title={t('Foydalanuvchilar holati')} counts={data.users.byStatus} />
              <CountList title={t('Ustalar holati')} counts={data.masters.byStatus} />
              <CountList title={t('Ustalar tasdiqlanishi')} counts={data.masters.byVerification} />
              <CountList title={t('So‘rovlar holati')} counts={data.requests.byStatus} />
              <CountList title={t('Buyurtmalar holati')} counts={data.orders.byStatus} />
              <CountList title={t('To‘lovlar holati')} counts={data.payments.byStatus} />
              <CountList title={t('Nizolar holati')} counts={data.disputes.byStatus} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
