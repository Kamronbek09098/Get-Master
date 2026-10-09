import { sanitizeMoney } from '@/lib/utils';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { useAddresses } from '@/features/customer/hooks/useCustomer';
import { useCreateDirectOrder } from '@/features/order/hooks/useOrders';
import { t } from '@/i18n';

/** «datetime-local» maydoni uchun hozirgi mahalliy vaqt (YYYY-MM-DDTHH:mm): undan oldingi vaqtni tanlab bo‘lmaydi. */
const nowLocal = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

/** Chat ichidan ustaga buyurtma yuborish oynasi (mijoz). */
export function DirectOrderDialog({ conversationId, masterName, onClose }: { conversationId: string; masterName: string; onClose: () => void }) {
  const create = useCreateDirectOrder(conversationId);
  const addresses = useAddresses();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [when, setWhen] = useState('');
  const [addressId, setAddressId] = useState('');

  const priceNumber = Number(price.replace(/\s/g, ''));
  const inPast = !!when && new Date(when).getTime() <= Date.now();
  const valid = !!when && !inPast && title.trim().length >= 3 && description.trim().length >= 3 && Number.isFinite(priceNumber) && priceNumber > 0;

  function submit() {
    if (!when || new Date(when).getTime() <= Date.now()) return;
    create.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        price: priceNumber,
        scheduledStartAt: new Date(when).toISOString(),
        addressId: addressId || undefined,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal
      open
      onClose={create.isPending ? () => undefined : onClose}
      title={t('Ustaga buyurtma yuborish')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>{t('Bekor qilish')}</Button>
          <Button loading={create.isPending} disabled={!valid} onClick={submit}>{t('Buyurtmani yuborish')}</Button>
        </>
      }
    >
      <div className="gm-form">
        <Alert tone="info">{t('Buyurtma')}{' '}<strong>{masterName}</strong>{t('ga yuboriladi. Usta qabul qilgach, ish odatdagi buyurtma kabi davom etadi: yo‘lga chiqish, ish, tasdiqlash va to‘lov.')}</Alert>
        {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}
        <Input label={t('Nima kerak?')} required maxLength={255} placeholder={t('Masalan, kranni almashtirish')} value={title} onChange={(event) => setTitle(event.target.value)} />
        <Textarea label={t('Tavsif')} required rows={3} maxLength={4000} hint={t('Muammo yoki ish haqida batafsil yozing')} value={description} onChange={(event) => setDescription(event.target.value)} />
        <Input label={t('Kelishilgan narx (so‘m)')} required inputMode="numeric" placeholder={t('Masalan, 150000')} value={price} onChange={(event) => setPrice(sanitizeMoney(event.target.value))} />
        <Input
          label={t('Qachon kelsin?')}
          required
          type="datetime-local"
          min={nowLocal()}
          value={when}
          error={inPast ? t('O‘tgan vaqtni tanlab bo‘lmaydi. Hozirgi yoki kelajakdagi vaqtni kiriting.') : undefined}
          onChange={(event) => setWhen(event.target.value)}
        />
        {(addresses.data?.length ?? 0) > 0 && (
          <Select
            label={t('Manzil (ixtiyoriy)')}
            value={addressId}
            onChange={(event) => setAddressId(event.target.value)}
            options={[{ value: '', label: t('Manzil tanlanmagan') }, ...(addresses.data ?? []).map((address) => ({ value: address.id, label: [address.title, address.addressLine].filter(Boolean).join(' — ') }))]}
          />
        )}
      </div>
    </Modal>
  );
}
