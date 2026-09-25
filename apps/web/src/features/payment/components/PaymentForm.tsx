import { useState } from 'react';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { newIdempotencyKey } from '@/lib/utils';
import type { PaymentProvider } from '@/types/common';
import { useCreatePayment } from '../hooks/usePayment';
import { PaymentStatus } from './PaymentStatus';

const PROVIDER_OPTIONS = [
  { value: 'CLICK', label: 'Click' },
  { value: 'PAYME', label: 'Payme' },
  { value: 'UZUM', label: 'Uzum' },
];

export function PaymentForm({ orderId }: { orderId: string }) {
  const [provider, setProvider] = useState<PaymentProvider>('CLICK');
  const [idempotencyKey] = useState(() => newIdempotencyKey());
  const createPayment = useCreatePayment();

  if (createPayment.data) {
    return (
      <div>
        <PaymentStatus payment={createPayment.data.payment} />
        <Alert tone="warning" title="Diqqat">
          Bu — test uchun ko‘rsatilgan havola: <code>{createPayment.data.checkoutUrl}</code>. Backendda hozircha
          haqiqiy to‘lov provayderi (Click/Payme/Uzum) ulanmagan — bu real to‘lov sahifasiga olib bormaydi.
        </Alert>
      </div>
    );
  }

  return (
    <div className="gm-auth-form" style={{ maxWidth: 320 }}>
      {createPayment.isError && <Alert tone="danger">{getErrorMessage(createPayment.error)}</Alert>}
      <Select
        label="To‘lov usuli"
        options={PROVIDER_OPTIONS}
        value={provider}
        onChange={(e) => setProvider(e.target.value as PaymentProvider)}
      />
      <Button
        loading={createPayment.isPending}
        onClick={() => createPayment.mutate({ orderId, provider, idempotencyKey })}
      >
        To‘lovni boshlash
      </Button>
    </div>
  );
}
