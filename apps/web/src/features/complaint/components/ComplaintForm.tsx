import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { useCreateComplaint } from '../hooks/useComplaints';
import { t } from '@/i18n';

export function ComplaintForm({ orderId }: { orderId?: string }) {
  const createComplaint = useCreateComplaint();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createComplaint.mutate(
      { orderId, title: title.trim(), description: description.trim() },
      {
        onSuccess: () => {
          setTitle('');
          setDescription('');
        },
      },
    );
  }

  return (
    <form className="gm-form" onSubmit={handleSubmit}>
      {createComplaint.isError && <Alert tone="danger">{getErrorMessage(createComplaint.error)}</Alert>}
      {createComplaint.isSuccess && <Alert tone="success">{t('Shikoyatingiz qabul qilindi')}</Alert>}
      <Input label={t('Mavzu')} required value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} />
      <Textarea
        label={t('Tavsif')}
        required
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={4}
      />
      <Button type="submit" loading={createComplaint.isPending} disabled={!title.trim() || !description.trim()}>{t('Shikoyat yuborish')}</Button>
    </form>
  );
}
