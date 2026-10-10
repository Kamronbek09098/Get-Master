import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { useCancelOrder, useResolveOrder } from '@/features/admin/hooks/useAdmin';
import type { AdminOrderDetail } from '@/features/admin/types';
import { t } from '@/i18n';

export type OrderActionMode = 'cancel' | 'COMPLETE' | 'CANCEL';

export function OrderActionDialog({ order, mode, onClose }: { order: Pick<AdminOrderDetail, 'id'>; mode: OrderActionMode; onClose: () => void }) {
  const cancel = useCancelOrder(order.id);
  const resolve = useResolveOrder(order.id);
  const [reason, setReason] = useState('');
  const pending = cancel.isPending || resolve.isPending;
  const error = cancel.error ?? resolve.error;
  const copy = {
    cancel: { title: t('Buyurtmani bekor qilish'), text: t('Buyurtma bekor qilinadi va mijoz bilan usta xabardor qilinadi.'), confirm: t('Bekor qilish'), variant: 'danger' as const },
    COMPLETE: { title: t('Nizoni yakunlash (buyurtma bajarilgan)'), text: t('Buyurtma «Yakunlandi» holatiga o‘tadi. Mijoz va usta xabardor qilinadi.'), confirm: t('Yakunlash'), variant: 'primary' as const },
    CANCEL: { title: t('Nizoni bekor qilish bilan hal qilish'), text: t('Buyurtma bekor qilinadi. Mijoz va usta xabardor qilinadi.'), confirm: t('Bekor qilish'), variant: 'danger' as const },
  }[mode];
  const submit = () => {
    const done = { onSuccess: onClose };
    if (mode === 'cancel') cancel.mutate(reason.trim(), done);
    else resolve.mutate({ decision: mode, reason: reason.trim() }, done);
  };

  return (
    <Modal
      open
      onClose={pending ? () => undefined : onClose}
      title={copy.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>{t('Ortga')}</Button>
          <Button variant={copy.variant} loading={pending} disabled={reason.trim().length < 3} onClick={submit}>
            {copy.confirm}
          </Button>
        </>
      }
    >
      <div className="gm-form">
        <Alert tone={copy.variant === 'danger' ? 'warning' : 'info'}>{copy.text}</Alert>
        {error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
        <Textarea label={t('Sabab / qaror izohi')} required rows={3} maxLength={1000} hint={t('Audit jurnaliga va tomonlarga yoziladi (kamida 3 ta belgi)')} value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>
    </Modal>
  );
}
