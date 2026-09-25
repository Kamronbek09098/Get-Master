import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardList, MapPin, Package, ShieldCheck, UserRound, Smartphone } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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

export function CustomerProfilePage() {
  const profile = useCustomerProfile();
  const addresses = useAddresses();
  const orders = useMyOrders();
  const requests = useMyRequests();

  if (profile.isLoading) return <PageLoader label="Profil yuklanmoqda…" />;
  if (profile.isError) return <Alert tone="danger">{getErrorMessage(profile.error)}</Alert>;
  if (!profile.data) return null;

  const data = profile.data;
  const name = accountName(data);
  const addressList = addresses.data ?? [];
  const requestCount = requests.data?.pages.reduce((sum, page) => sum + page.items.length, 0) ?? 0;

  return (
    <div className="gm-ppage">
      <div className="gm-page-header" style={{ marginBottom: 0 }}>
        <h1>Mening profilim</h1>
      </div>

      <ProfileHero
        name={name}
        seed={data.id}
        accountNumber={data.accountNumber}
        subtitle={data.phone}
        badges={
          <>
            <Badge tone="primary">Mijoz</Badge>
            <Badge tone={data.phoneVerified ? 'success' : 'warning'}>{data.phoneVerified ? 'Telefon tasdiqlangan' : 'Telefon tasdiqlanmagan'}</Badge>
            <Badge tone={data.status === 'ACTIVE' ? 'success' : 'neutral'}>{statusLabel(data.status)}</Badge>
          </>
        }
        stats={[
          { icon: ClipboardList, label: 'So‘rovlar', value: requests.isLoading ? '…' : requestCount },
          { icon: Package, label: 'Buyurtmalar', value: orders.isLoading ? '…' : (orders.data?.length ?? 0) },
          { icon: MapPin, label: 'Manzillar', value: addresses.isLoading ? '…' : addressList.length },
          { icon: CalendarDays, label: 'A’zo bo‘lgan', value: <span style={{ fontSize: '1rem' }}>{formatDate(data.createdAt)}</span> },
        ]}
      />

      <div className="gm-pgrid">
        <div className="gm-pcol">
          <ProfileCard icon={UserRound} title="Shaxsiy ma’lumotlar" hint="Ism va familiyangiz boshqa foydalanuvchilarga ko‘rinadi.">
            <CustomerForm profile={data} />
          </ProfileCard>
          <ProfileCard icon={MapPin} title="Manzillarim" hint="So‘rov yaratganda tez tanlash uchun.">
            {addressList.length === 0 ? (
              <p className="gm-card__meta">Hali manzil qo‘shilmagan.</p>
            ) : (
              <InfoRows rows={addressList.slice(0, 3).map((address) => ({ label: address.title ?? 'Manzil', value: address.addressLine }))} />
            )}
            <Link to="/mijozlar/manzillar">
              <Button variant="secondary" size="sm">{addressList.length === 0 ? 'Manzil qo‘shish' : 'Manzillarni boshqarish'}</Button>
            </Link>
          </ProfileCard>
        </div>

        <div className="gm-pcol">
          <ProfileCard icon={Smartphone} title="Akkaunt ma’lumotlari">
            <InfoRows
              rows={[
                { label: 'Akkaunt ID', value: data.accountNumber },
                { label: 'Telefon', value: data.phone },
                { label: 'Email', value: data.email ?? '—' },
                { label: 'Telefon tasdiqlangan', value: data.phoneVerified ? 'Ha' : 'Yo‘q' },
                { label: 'Holat', value: statusLabel(data.status) },
                { label: 'Ro‘yxatdan o‘tgan', value: formatDate(data.createdAt) },
              ]}
            />
          </ProfileCard>
          <ProfileCard icon={ShieldCheck} title="Xavfsizlik" hint="Akkauntingizga ulangan qurilmalarni boshqaring.">
            <Link to="/sozlamalar">
              <Button variant="secondary" size="sm">Faol qurilmalar va sozlamalar</Button>
            </Link>
          </ProfileCard>
        </div>
      </div>
    </div>
  );
}
