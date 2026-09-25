import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageLoader } from '@/components/common/PageLoader';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/error-messages';
import { useAddresses, useCreateAddress, useDeleteAddress } from '@/features/customer/hooks/useCustomer';

export function CustomerPage() {
  const addresses = useAddresses();
  const createAddress = useCreateAddress();
  const deleteAddress = useDeleteAddress();
  const [title, setTitle] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createAddress.mutate(
      { title: title || undefined, addressLine, city: city || undefined },
      {
        onSuccess: () => {
          setTitle('');
          setAddressLine('');
          setCity('');
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
            {address.city && <p className="gm-card__meta">{address.city}</p>}
          </div>
        ))}
      </div>
      <section className="gm-detail-section">
        <h2>Yangi manzil</h2>
        <form className="gm-form" onSubmit={handleSubmit}>
          {createAddress.isError && <Alert tone="danger">{getErrorMessage(createAddress.error)}</Alert>}
          <Input label="Nomi" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Uy, ish…" />
          <Input
            label="Manzil"
            required
            value={addressLine}
            onChange={(event) => setAddressLine(event.target.value)}
          />
          <Input label="Shahar" value={city} onChange={(event) => setCity(event.target.value)} />
          <Button type="submit" loading={createAddress.isPending} disabled={!addressLine.trim()}>
            Qo‘shish
          </Button>
        </form>
      </section>
    </div>
  );
}
