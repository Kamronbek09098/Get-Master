import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { useCreateDispute } from '../hooks/useDisputes';

export function DisputeForm({ orderId }: { orderId: string }) {
  const createDispute = useCreateDispute();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createDispute.mutate({ orderId, title: title.trim(), description: description.trim() });
  }

  if (createDispute.isSuccess) {
    return <Alert tone="success">Nizo ochildi. Administrator uni ko‘rib chiqadi.</Alert>;
  }

  return (
    <form className="gm-form" onSubmit={handleSubmit}>
      {createDispute.isError && <Alert tone="danger">{getErrorMessage(createDispute.error)}</Alert>}
      <Input label="Mavzu" required value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} />
      <Textarea
        label="Muammo tavsifi"
        required
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={4}
      />
      <Button type="submit" variant="danger" loading={createDispute.isPending} disabled={!title.trim() || !description.trim()}>
        Nizo ochish
      </Button>
    </form>
  );
}
