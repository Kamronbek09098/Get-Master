import { Navigate, useParams } from 'react-router-dom';
import { useCustomerProfile } from '@/features/customer/hooks/useCustomer';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate } from '@/lib/utils';
import { statusLabel } from '@/lib/labels';
import { SavedMastersCard } from '@/features/customer/components/CustomerSaved';
import { CustomerActivity } from '@/features/customer/components/CustomerActivity';
import { CustomerForm } from '@/features/customer/components/CustomerForm';
import { useMyOrders } from '@/features/order/hooks/useOrders';
import { CustomerProfileDashboard } from '@/features/customer/profile/CustomerProfileDashboard';
import { InfoRows } from '@/features/profile/ProfileCard';
import { ProfileSubPage } from '@/features/profile/ProfileMenu';
import { GoogleLinkSettings } from '@/features/session/components/GoogleLinkSettings';
import '@/features/profile/Profile.css';
import { t } from '@/i18n';

const BASE = '/mijoz/profil';

/** Mijoz profili: asosiy sahifada menyu, har bir qator — alohida ichki bo‘lim (ilova uslubi). */
export function CustomerProfilePage() {
  const { section } = useParams();
  const profile = useCustomerProfile();
  const orders = useMyOrders();

  if (profile.isLoading) return <PageLoader label={t('Profil yuklanmoqda…')} />;
  if (profile.isError) return <Alert tone="danger">{getErrorMessage(profile.error)}</Alert>;
  if (!profile.data) return null;

  const data = profile.data;

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
  if (section) return <Navigate to={BASE} replace />;

  return <CustomerProfileDashboard profile={data} />;
}
