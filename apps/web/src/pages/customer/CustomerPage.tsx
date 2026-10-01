import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageLoader } from '@/components/common/PageLoader';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/error-messages';
import { AddressPicker } from '@/features/geo/components/AddressPicker';
import type { PickedAddress } from '@/features/geo/components/AddressPicker';
import { MapPin } from 'lucide-react';
import { useAddresses, useCreateAddress, useDeleteAddress } from '@/features/customer/hooks/useCustomer';

export function CustomerPage() {
  const addresses = useAddresses();
  const createAddress = useCreateAddress();
  const deleteAddress = useDeleteAddress();
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<PickedAddress>({ addressLine: '', city: '', district: '', latitude: null, longitude: null });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createAddress.mutate(
      {
        title: title || undefined,
        addressLine: picked.addressLine.trim(),
        city: picked.city || undefined,
        district: picked.district || undefined,
        latitude: picked.latitude ?? undefined,
        longitude: picked.longitude ?? undefined,
      },
      {
        onSuccess: () => {
          setTitle('');
          setPicked({ addressLine: '', city: '', district: '', latitude: null, longitude: null });
        },
      },
    );
  }

  const items = addresses.data ?? [];

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>Manzillarim</h1>
          <p className="gm-page-lead">So‘rov yaratganda tez tanlash uchun manzillaringiz.</p>
        </div>
      </div>
      {addresses.isLoading && <PageLoader label="Manzillar yuklanmoqda…" />}
      {addresses.isError && <Alert tone="danger">{getErrorMessage(addresses.error)}</Alert>}
      {deleteAddress.isError && <Alert tone="danger">{getErrorMessage(deleteAddress.error)}</Alert>}
      {!addresses.isLoading && items.length === 0 && <EmptyState title="Hali manzil qo‘shilmagan" />}
      <div className="gm-list">
        {items.map((address) => (
          <div key={address.id} className="gm-card">
            <div className="gm-card__header">
              <h3>{address.title ?? 'Manzil'}</h3>
              <Button size="sm" variant="danger" onClick={() => deleteAddress.mutate(address.id)}>
                O‘chirish
              </Button>
            </div>
            <p>{address.addressLine}</p>
            <p className="gm-card__meta">
              {[address.district, address.city].filter(Boolean).join(', ')}
              {address.latitude != null && address.longitude != null && (
                <a
                  className="gm-addr-maplink"
                  href={`https://www.openstreetmap.org/?mlat=${address.latitude}&mlon=${address.longitude}#map=17/${address.latitude}/${address.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin size={13} aria-hidden="true" /> Xaritada
                </a>
              )}
            </p>
          </div>
        ))}
      </div>
      <section className="gm-detail-section">
        <h2>Yangi manzil</h2>
        <form className="gm-form" onSubmit={handleSubmit}>
          {createAddress.isError && <Alert tone="danger">{getErrorMessage(createAddress.error)}</Alert>}
          <Input label="Nomi" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Uy, ish…" />
          <div className="gm-chips" role="group" aria-label="Tez tanlash">
            {['Uy', 'Ish', 'Ota-ona uyi'].map((name) => (
              <button key={name} type="button" className={title === name ? 'gm-chip gm-chip--on' : 'gm-chip'} onClick={() => setTitle(name)}>
                {name}
              </button>
            ))}
          </div>
          <AddressPicker value={picked} onChange={setPicked} />
          <Button type="submit" loading={createAddress.isPending} disabled={!picked.addressLine.trim()}>
            Qo‘shish
          </Button>
        </form>
      </section>
    </div>
  );
}
