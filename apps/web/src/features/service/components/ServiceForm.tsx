import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { getErrorMessage } from '@/lib/error-messages';
import { useAddMyService, useServiceCategories } from '../hooks/useServices';

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
    <form className="gm-form" onSubmit={handleSubmit}>
      {addService.isError && <Alert tone="danger">{getErrorMessage(addService.error)}</Alert>}
      <Select
        label="Xizmat"
        required
        placeholder="Xizmatni tanlang"
        options={options}
        value={serviceId}
        onChange={(event) => setServiceId(event.target.value)}
      />
      <Input label="Narx (so‘m)" type="number" min={0} value={price} onChange={(event) => setPrice(event.target.value)} />
      <Input label="Izoh" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} />
      <Button type="submit" loading={addService.isPending} disabled={!serviceId}>
        Xizmat qo‘shish
      </Button>
    </form>
  );
}
