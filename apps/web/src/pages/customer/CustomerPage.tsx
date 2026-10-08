import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageLoader } from '@/components/common/PageLoader';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/error-messages';
import { AddressMastersDialog, CoverageButton, CoverageSummary } from '@/features/master/components/AddressMastersDialog';
import { AddressPicker } from '@/features/geo/components/AddressPicker';
import type { PickedAddress } from '@/features/geo/components/AddressPicker';
import { MapPin, MapPinPlus, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import './CustomerPage.css';
import { useAddresses, useCreateAddress, useDeleteAddress } from '@/features/customer/hooks/useCustomer';
import { t } from '@/i18n';

export function CustomerPage() {
  const addresses = useAddresses();
  const createAddress = useCreateAddress();
  const deleteAddress = useDeleteAddress();
  const [title, setTitle] = useState('');
  const [toDelete, setToDelete] = useState<{ id: string; title?: string | null; addressLine: string } | null>(null);
  const [coverageFor, setCoverageFor] = useState<{ lat: number; lon: number; addressLine: string } | null>(null);
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
          <h1>{t('Manzillarim')}</h1>
          <p className="gm-page-lead">{t('So‘rov yaratganda tez tanlash uchun manzillaringiz')}</p>
        </div>
      </div>
      {addresses.isLoading && <PageLoader label={t('Manzillar yuklanmoqda…')} />}
      {addresses.isError && <Alert tone="danger">{getErrorMessage(addresses.error)}</Alert>}
      {deleteAddress.isError && <Alert tone="danger">{getErrorMessage(deleteAddress.error)}</Alert>}
      {!addresses.isLoading && items.length === 0 && <EmptyState title={t('Hali manzil qo‘shilmagan')} />}
      <div className="gm-list">
        {items.map((address) => {
          const place = [address.district, address.city].filter(Boolean).join(', ');
          const located = address.latitude != null && address.longitude != null;
          return (
            <div key={address.id} className="gm-addr-card">
              <span className="gm-addr-card__icon" aria-hidden="true">
                <MapPin size={20} />
              </span>
              <div className="gm-addr-card__body">
                <h3>{address.title ?? t('Manzil')}</h3>
                <p className="gm-addr-card__line">{address.addressLine}</p>
                <div className="gm-addr-card__chips">
                  {place && <span className="gm-addr-chip">{place}</span>}
                  {located && (
                    <a
                      className="gm-addr-chip gm-addr-chip--link"
                      href={`https://www.openstreetmap.org/?mlat=${address.latitude}&mlon=${address.longitude}#map=17/${address.latitude}/${address.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin size={13} aria-hidden="true" />{' '}{t('Xaritada ochish')}</a>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="gm-btn-tone gm-btn-tone--danger gm-addr-card__delete"
                onClick={() => setToDelete(address)}
                aria-label={t('{p}ni o‘chirish', { p: address.title ?? 'Manzil' })}
              >
                <Trash2 size={15} />{' '}{t('O‘chirish')}</Button>
              {located && (
                <div className="gm-addr-card__foot">
                  <CoverageButton
                    lat={Number(address.latitude)}
                    lon={Number(address.longitude)}
                    onOpen={() => setCoverageFor({ lat: Number(address.latitude), lon: Number(address.longitude), addressLine: address.addressLine })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <section className="gm-detail-section gm-addrform">
        <header className="gm-addrform__head">
          <span className="gm-addrform__icon" aria-hidden="true">
            <MapPinPlus size={20} />
          </span>
          <div>
            <h2>{t('Yangi manzil')}</h2>
            <p>{t('Manzilni yozing, xaritadan tanlang yoki joriy joylashuvingizni aniqlang.')}</p>
          </div>
        </header>
        <form className="gm-form gm-addrform__form" onSubmit={handleSubmit}>
          {createAddress.isError && <Alert tone="danger">{getErrorMessage(createAddress.error)}</Alert>}
          <AddressPicker value={picked} onChange={setPicked} />
          {picked.latitude != null && picked.longitude != null && (
            <CoverageSummary lat={picked.latitude} lon={picked.longitude} onOpen={() => setCoverageFor({ lat: picked.latitude as number, lon: picked.longitude as number, addressLine: picked.addressLine })} />
          )}
          <Input label={t('Nomi (ixtiyoriy)')} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('Masalan: Uy, Ish')} maxLength={100} />
          <Button type="submit" className="gm-addrform__submit" loading={createAddress.isPending} disabled={!picked.addressLine.trim()}>
            <Plus size={18} />{' '}{t('Manzilni qo‘shish')}</Button>
        </form>
      </section>
      <ConfirmDialog
        open={toDelete !== null}
        title={t('Manzilni o‘chirish')}
        description={t('“{p}” manzili ro‘yxatingizdan o‘chiriladi.', { p: toDelete?.title ?? toDelete?.addressLine ?? '' })}
        confirmLabel={t('O‘chirish')}
        cancelLabel={t('Bekor qilish')}
        tone="danger"
        loading={deleteAddress.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteAddress.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })}
      />
      <AddressMastersDialog
        open={coverageFor !== null}
        onClose={() => setCoverageFor(null)}
        lat={coverageFor?.lat ?? null}
        lon={coverageFor?.lon ?? null}
        addressLine={coverageFor?.addressLine}
      />
    </div>
  );
}
