import { useState } from 'react';
import type { FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { getErrorMessage } from '@/lib/error-messages';
import { useAddMyService, useServiceCategories } from '../hooks/useServices';
import './service.css';
import { t } from '@/i18n';

export function ServiceForm() {
  const categories = useServiceCategories();
  const addService = useAddMyService();
  const [serviceId, setServiceId] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');

  const options = (categories.data ?? []).flatMap((category) =>
    category.services.map((service) => ({ value: service.id, label: `${category.name} — ${service.name}` })),
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    addService.mutate(
      {
        serviceId,
        basePrice: price ? Number(price) : undefined,
        description: description || undefined,
      },
      {
        onSuccess: () => {
          setServiceId('');
          setPrice('');
          setDescription('');
        },
      },
    );
  }

  return (
    <form className="gm-form gm-svc-form" onSubmit={handleSubmit}>
      <h3 className="gm-svc-form__title">{t('Yangi xizmat qo‘shish')}</h3>
      {addService.isError && <Alert tone="danger">{getErrorMessage(addService.error)}</Alert>}
      <Select
        label={t('Xizmat')}
        required
        placeholder={t('Xizmatni tanlang')}
        options={options}
        value={serviceId}
        onChange={(event) => setServiceId(event.target.value)}
      />
      <MoneyInput label={t('Narx (so‘m)')} hint={t('Bo‘sh qoldirsangiz, narx mijoz bilan kelishiladi.')} placeholder={t('Masalan: 150 000')} value={price} onValueChange={setPrice} />
      <Input
        label={t('Izoh')}
        placeholder={t('Qisqacha tavsif (ixtiyoriy)')}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={500}
      />
      <Button type="submit" size="lg" fullWidth className="gm-svc-submit" loading={addService.isPending} disabled={!serviceId}>
        <Plus size={18} />{' '}{t('Xizmat qo‘shish')}</Button>
      {!serviceId && <p className="gm-svc-submit__hint">{t('Avval ro‘yxatdan xizmatni tanlang.')}</p>}
    </form>
  );
}
