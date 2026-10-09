import { useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, BadgeCheck, CalendarCheck, ClipboardList, Clapperboard, Crown, Eye, Heart, MessageCircle, PackageCheck, RefreshCw, Scale, Star, UserRound, Users, Wallet, Wrench } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { formatMoney } from '@/lib/utils';
import { useDashboard } from '@/features/admin/hooks/useAdmin';
import { CountList, StatGrid } from '@/features/admin/components/StatGrid';
import type { StatTone } from '@/features/admin/components/StatGrid';
import { DateRangeFilter } from '@/features/admin/components/DateRangeFilter';
import { toRange } from '@/features/admin/range';
import './AdminDashboardPage.css';
import { t } from '@/i18n';

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="gm-dash-section">
      <header className="gm-dash-section__head">
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
      </header>
      {children}
    </section>
  );
}

/** Navbat bo‘sh bo‘lsa — yashil, to‘lib qolsa — sariq, xato bo‘lsa — qizil. */
const queueTone = (count: number, danger = false): StatTone => (count === 0 ? 'ok' : danger ? 'danger' : 'warn');

export function AdminDashboardPage() {
  const [range, setRange] = useState({ from: '', to: '' });
  const dashboard = useDashboard(toRange(range));
  const data = dashboard.data;
  const updated = dashboard.dataUpdatedAt ? new Date(dashboard.dataUpdatedAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : null;
  const filtered = !!range.from || !!range.to;

  return (
    <div className="gm-dash">
      <div className="gm-dash-top">
        <div>
          <h1>{t('Boshqaruv paneli')}</h1>
          <p className="gm-page-lead">
            {t('Platforma bo‘yicha umumiy ko‘rsatkichlar')}
            {updated && <span className="gm-dash-top__time"> · {t('Yangilandi')}: {updated}</span>}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void dashboard.refetch()} loading={dashboard.isFetching && !dashboard.isLoading}>
          <RefreshCw size={15} /> {t('Yangilash')}
        </Button>
      </div>

      {dashboard.isLoading && <PageLoader label={t('Statistika yuklanmoqda…')} />}
      {dashboard.isError && <Alert tone="danger">{getErrorMessage(dashboard.error)}</Alert>}

      {data && (
        <>
          <Section title={t('E’tibor talab qiladi')} hint={t('Hozirgi holat — davr filtriga bog‘liq emas')}>
            <StatGrid
              balanced
              items={[
                { label: t('Tasdiqlash kutayotgan ustalar'), value: data.attention.pendingVerifications, icon: <BadgeCheck size={20} />, to: '/admin/tasdiqlash', tone: queueTone(data.attention.pendingVerifications) },
                { label: t('Ochiq shikoyat va nizolar'), value: data.attention.openCases, icon: <Scale size={20} />, to: '/admin/shikoyatlar', tone: queueTone(data.attention.openCases, true) },
                { label: t('Tasdiq kutayotgan obunalar'), value: data.attention.pendingSubscriptions, icon: <Crown size={20} />, to: '/admin/obunalar', tone: queueTone(data.attention.pendingSubscriptions) },
                { label: t('Jarayondagi buyurtmalar'), value: data.attention.activeOrders, icon: <PackageCheck size={20} />, to: '/admin/buyurtmalar' },
                { label: t('Server xatolari (24 soat)'), value: data.attention.errors24h, icon: <AlertTriangle size={20} />, to: '/admin/errorlar', tone: data.attention.errors24h === 0 ? 'ok' : data.attention.errors24h >= 50 ? 'danger' : 'warn' },
              ]}
            />
          </Section>

          <Section title={t('Bugun')} hint={t('Bugungi 00:00 dan boshlab')}>
            <StatGrid
              balanced
              items={[
                { label: t('Yangi foydalanuvchilar'), value: data.today.newUsers, icon: <Users size={20} /> },
                { label: t('Yangi so‘rovlar'), value: data.today.newRequests, icon: <ClipboardList size={20} /> },
                { label: t('Yangi buyurtmalar'), value: data.today.newOrders, icon: <PackageCheck size={20} /> },
                { label: t('Yakunlangan buyurtmalar'), value: data.today.completedOrders, icon: <CalendarCheck size={20} /> },
                { label: t('Bugungi tushum'), value: formatMoney(data.today.revenue), icon: <Wallet size={20} />, to: '/admin/hisobot' },
              ]}
            />
          </Section>

          <Section title={t('Obunalar va ish lentasi')} hint={t('Hozirgi holat')}>
            <StatGrid
              balanced
              items={[
                { label: t('Faol obunalar'), value: data.subscriptions.activeTotal, icon: <Crown size={20} />, to: '/admin/obunalar' },
                ...Object.entries(data.subscriptions.activeByPlan).map(([plan, count]) => ({ label: t('Obuna: {plan}', { plan: plan.replace(/_/g, ' ') }), value: count, icon: <Crown size={20} /> })),
                { label: t('Obuna tushumi'), value: formatMoney(data.subscriptions.purchasedAmount), icon: <Wallet size={20} /> },
                { label: t('Lentadagi ishlar'), value: data.feed.posts, icon: <Clapperboard size={20} /> },
                { label: t('Ko‘rishlar'), value: data.feed.views, icon: <Eye size={20} /> },
                { label: t('Yoqtirishlar'), value: data.feed.likes, icon: <Heart size={20} /> },
                { label: t('Izohlar'), value: data.feed.comments, icon: <MessageCircle size={20} /> },
              ]}
            />
          </Section>

          <DateRangeFilter value={range} onChange={setRange} />

          <Section title={t('Umumiy ko‘rsatkichlar')} hint={filtered ? t('Tanlangan davr bo‘yicha') : t('Butun davr bo‘yicha')}>
            <StatGrid
              balanced
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
          </Section>

          <Section title={t('Holatlar bo‘yicha')} hint={filtered ? t('Tanlangan davr bo‘yicha') : t('Butun davr bo‘yicha')}>
            <div className="gm-count-grid gm-count-grid--dash">
              <CountList title={t('Foydalanuvchilar holati')} counts={data.users.byStatus} />
              <CountList title={t('Ustalar holati')} counts={data.masters.byStatus} />
              <CountList title={t('Ustalar tasdiqlanishi')} counts={data.masters.byVerification} />
              <CountList title={t('So‘rovlar holati')} counts={data.requests.byStatus} />
              <CountList title={t('Buyurtmalar holati')} counts={data.orders.byStatus} />
              <CountList title={t('To‘lovlar holati')} counts={data.payments.byStatus} />
              <CountList title={t('Nizolar holati')} counts={data.disputes.byStatus} />
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
