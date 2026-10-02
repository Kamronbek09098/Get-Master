import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, ClipboardList, MapPin, MapPinPlus, Package, Settings2, ShieldCheck, UserRound, Smartphone } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate } from '@/lib/utils';
import { statusLabel } from '@/lib/labels';
import { useAddresses, useCustomerProfile } from '@/features/customer/hooks/useCustomer';
import { CustomerForm } from '@/features/customer/components/CustomerForm';
import { useMyOrders } from '@/features/order/hooks/useOrders';
import { useMyRequests } from '@/features/request/hooks/useRequests';
import { ProfileHero } from '@/features/profile/ProfileHero';
import { InfoRows, ProfileCard } from '@/features/profile/ProfileCard';
import '@/features/profile/Profile.css';
import { t } from '@/i18n';

export function CustomerProfilePage() {
  const profile = useCustomerProfile();
  const addresses = useAddresses();
  const orders = useMyOrders();
  const requests = useMyRequests();

  if (profile.isLoading) return <PageLoader label={t('Profil yuklanmoqda…')} />;
  if (profile.isError) return <Alert tone="danger">{getErrorMessage(profile.error)}</Alert>;
  if (!profile.data) return null;

  const data = profile.data;
  const name = accountName(data);
  const addressList = addresses.data ?? [];
  const requestCount = requests.data?.pages.reduce((sum, page) => sum + page.items.length, 0) ?? 0;

  return (
    <div className="gm-ppage">
      <div className="gm-page-header" style={{ marginBottom: 0 }}>
        <h1>{t('Mening profilim')}</h1>
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
            <Badge tone={data.status === 'ACTIVE' ? 'success' : 'neutral'}>{statusLabel(data.status)}</Badge>
          </>
        }
        stats={[
          { icon: ClipboardList, label: t('So‘rovlar'), value: requests.isLoading ? '…' : requestCount },
          { icon: Package, label: t('Buyurtmalar'), value: orders.isLoading ? '…' : (orders.data?.length ?? 0) },
          { icon: MapPin, label: t('Manzillar'), value: addresses.isLoading ? '…' : addressList.length },
          { icon: CalendarDays, label: t('A’zo bo‘lgan'), value: <span style={{ fontSize: '1rem' }}>{formatDate(data.createdAt)}</span> },
        ]}
      />

      <div className="gm-pgrid">
        <div className="gm-pcol">
          <ProfileCard defaultOpen icon={UserRound} title={t('Shaxsiy ma’lumotlar')} hint={t('Ism va familiyangiz boshqa foydalanuvchilarga ko‘rinadi.')}>
            <CustomerForm profile={data} />
          </ProfileCard>
          <ProfileCard icon={MapPin} title={t('Manzillarim')} hint={t('So‘rov yaratganda tez tanlash uchun.')}>
            {addressList.length === 0 ? (
              <p className="gm-pempty">{t('Hali manzil qo‘shilmagan.')}</p>
            ) : (
              <ul className="gm-addrlist">
                {addressList.slice(0, 3).map((address) => (
                  <li key={address.id}>
                    <span className="gm-addrlist__pin" aria-hidden="true">
                      <MapPin size={16} />
                    </span>
                    <span className="gm-addrlist__text">
                      <strong>{address.title ?? t('Manzil')}</strong>
                      <span>{address.addressLine}</span>
                    </span>
                  </li>
                ))}
                {addressList.length > 3 && <li className="gm-addrlist__more">{t('va yana {p} ta manzil', { p: addressList.length - 3 })}</li>}
              </ul>
            )}
            <Link to="/mijozlar/manzillar" className="gm-plink">
              <span className="gm-plink__icon" aria-hidden="true">{addressList.length === 0 ? <MapPinPlus size={18} /> : <MapPin size={18} />}</span>
              <span className="gm-plink__label">{addressList.length === 0 ? t('Manzil qo‘shish') : t('Manzillarni boshqarish')}</span>
              <ChevronRight size={18} className="gm-plink__arrow" aria-hidden="true" />
            </Link>
          </ProfileCard>
        </div>

        <div className="gm-pcol">
          <ProfileCard icon={Smartphone} title={t('Akkaunt ma’lumotlari')}>
            <InfoRows
              rows={[
                { label: t('Akkaunt ID'), value: `#${data.accountNumber}` },
                { label: t('Telefon'), value: data.phone },
                { label: t('Email'), value: data.email ?? <span className="gm-pmuted">{t('Kiritilmagan')}</span> },
                { label: t('Telefon tasdiqlangan'), value: <Badge tone={data.phoneVerified ? 'success' : 'warning'}>{data.phoneVerified ? 'Ha' : t('Yo‘q')}</Badge> },
                { label: t('Holat'), value: <Badge tone={data.status === 'ACTIVE' ? 'success' : 'neutral'}>{statusLabel(data.status)}</Badge> },
                { label: t('Ro‘yxatdan o‘tgan'), value: formatDate(data.createdAt) },
              ]}
            />
          </ProfileCard>
          <ProfileCard icon={ShieldCheck} title={t('Xavfsizlik')} hint={t('Akkauntingizga ulangan qurilmalarni boshqaring.')}>
            <Link to="/sozlamalar" className="gm-plink">
              <span className="gm-plink__icon" aria-hidden="true">
                <Settings2 size={18} />
              </span>
              <span className="gm-plink__label">{t('Faol qurilmalar va sozlamalar')}</span>
              <ChevronRight size={18} className="gm-plink__arrow" aria-hidden="true" />
            </Link>
          </ProfileCard>
        </div>
      </div>
    </div>
  );
}
