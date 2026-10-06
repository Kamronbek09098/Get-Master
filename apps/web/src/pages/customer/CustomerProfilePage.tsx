import { Navigate, useParams } from 'react-router-dom';
import { CalendarDays, ClipboardList, Heart, LogOut, MapPin, Package, Settings, UserRound, Users, Wallet } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate } from '@/lib/utils';
import { statusLabel } from '@/lib/labels';
import { useAddresses, useCustomerPreferences, useCustomerProfile } from '@/features/customer/hooks/useCustomer';
import { useFavorites } from '@/features/customer/hooks/useFavorites';
import { PaymentPreferenceCard, SavedMastersCard } from '@/features/customer/components/CustomerSaved';
import { CustomerActivity } from '@/features/customer/components/CustomerActivity';
import { CustomerForm } from '@/features/customer/components/CustomerForm';
import { useLogout } from '@/features/auth/hooks/useAuth';
import { providerLabel } from '@/features/payment/labels';
import { useMyOrders } from '@/features/order/hooks/useOrders';
import { useMyRequests } from '@/features/request/hooks/useRequests';
import { ProfileHero } from '@/features/profile/ProfileHero';
import { InfoRows } from '@/features/profile/ProfileCard';
import { ProfileMenuList, ProfileSubPage } from '@/features/profile/ProfileMenu';
import { GoogleLinkSettings } from '@/features/session/components/GoogleLinkSettings';
import '@/features/profile/Profile.css';
import { t } from '@/i18n';

const BASE = '/mijozlar/profil';

/** Mijoz profili: asosiy sahifada menyu, har bir qator — alohida ichki bo‘lim (ilova uslubi). */
export function CustomerProfilePage() {
  const { section } = useParams();
  const profile = useCustomerProfile();
  const addresses = useAddresses();
  const orders = useMyOrders();
  const requests = useMyRequests();
  const favorites = useFavorites();
  const preferences = useCustomerPreferences();
  const logout = useLogout();

  if (profile.isLoading) return <PageLoader label={t('Profil yuklanmoqda…')} />;
  if (profile.isError) return <Alert tone="danger">{getErrorMessage(profile.error)}</Alert>;
  if (!profile.data) return null;

  const data = profile.data;
  const name = accountName(data);
  const addressCount = addresses.data?.length ?? 0;
  const requestCount = requests.data?.pages.reduce((sum, page) => sum + page.items.length, 0) ?? 0;

  if (section === 'tahrirlash') {
    return (
      <ProfileSubPage title={t('Profilni tahrirlash')} backTo={BASE}>
        <InfoRows
          rows={[
            { label: t('Akkaunt ID'), value: `#${data.accountNumber}` },
            { label: t('Telefon'), value: data.phone ?? <span className="gm-pmuted">{t('Kiritilmagan')}</span> },
            { label: t('Email'), value: data.email ?? <span className="gm-pmuted">{t('Kiritilmagan')}</span> },
            { label: t('Telefon tasdiqlangan'), value: <Badge tone={data.phoneVerified ? 'success' : 'warning'}>{data.phoneVerified ? 'Ha' : t('Yo‘q')}</Badge> },
            { label: t('Holat'), value: <Badge tone={data.status === 'ACTIVE' ? 'success' : 'neutral'}>{statusLabel(data.status)}</Badge> },
            { label: t('Ro‘yxatdan o‘tgan'), value: formatDate(data.createdAt) },
          ]}
        />
        <div className="gm-pmerge__divider" />
        <CustomerForm profile={data} />
        <div className="gm-pmerge__divider" />
        <GoogleLinkSettings />
      </ProfileSubPage>
    );
  }
  if (section === 'ustalar') {
    return (
      <ProfileSubPage title={t('Birga ishlagan ustalar')} backTo={BASE}>
        <CustomerActivity orders={orders.data ?? []} />
      </ProfileSubPage>
    );
  }
  if (section === 'saqlangan') {
    return (
      <ProfileSubPage title={t('Saqlangan ustalar')} backTo={BASE}>
        <SavedMastersCard />
      </ProfileSubPage>
    );
  }
  if (section === 'tolov') {
    return (
      <ProfileSubPage title={t('To‘lov usuli')} backTo={BASE}>
        <PaymentPreferenceCard />
      </ProfileSubPage>
    );
  }
  if (section) return <Navigate to={BASE} replace />;

  return (
    <div className="gm-pmenu-page">
      <div className="gm-page-header" style={{ marginBottom: 0 }}>
        <h1>{t('Profil')}</h1>
      </div>

      <ProfileHero
        name={name}
        seed={data.id}
        accountNumber={data.accountNumber}
        subtitle={data.phone}
        badges={
          <>
            <Badge tone="primary">{t('Mijoz')}</Badge>
            <Badge tone={data.phoneVerified ? 'success' : 'warning'}>{data.phoneVerified ? t('Telefon tasdiqlangan') : t('Telefon tasdiqlanmagan')}</Badge>
          </>
        }
        stats={[
          { icon: ClipboardList, label: t('So‘rovlar'), value: requests.isLoading ? '…' : requestCount },
          { icon: Package, label: t('Buyurtmalar'), value: orders.isLoading ? '…' : (orders.data?.length ?? 0) },
          { icon: CalendarDays, label: t('A’zo bo‘lgan'), value: <span style={{ fontSize: '1rem' }}>{formatDate(data.createdAt)}</span> },
        ]}
      />

      <ProfileMenuList
        rows={[
          { key: 'edit', icon: UserRound, label: t('Profilni tahrirlash'), to: `${BASE}/tahrirlash` },
          { key: 'addr', icon: MapPin, label: t('Manzillarim'), value: addressCount || undefined, to: '/mijozlar/manzillar' },
          { key: 'masters', icon: Users, label: t('Birga ishlagan ustalar'), to: `${BASE}/ustalar` },
          { key: 'saved', icon: Heart, label: t('Saqlangan ustalar'), value: favorites.data?.length || undefined, to: `${BASE}/saqlangan` },
          { key: 'pay', icon: Wallet, label: t('To‘lov usuli'), value: providerLabel(preferences.data?.paymentMethod ?? 'CASH'), to: `${BASE}/tolov` },
          { key: 'settings', icon: Settings, label: t('Sozlamalar'), to: '/sozlamalar' },
          { key: 'logout', icon: LogOut, label: t('Tizimdan chiqish'), danger: true, onClick: () => logout.mutate(false) },
        ]}
      />
    </div>
  );
}
