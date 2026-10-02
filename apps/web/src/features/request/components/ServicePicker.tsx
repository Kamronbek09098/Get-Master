import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ServiceChooser } from '@/features/service/components/ServiceChooser';
import { getErrorMessage } from '@/lib/error-messages';
import { useSetRequestService } from '../hooks/useRequests';
import { t } from '@/i18n';

export function ServicePicker({ requestId }: { requestId: string }) {
  const [serviceId, setServiceId] = useState('');
  const setService = useSetRequestService(requestId);

  return (
    <div className="gm-form">
      <Alert tone="warning" title={t('Xizmat turi tanlanmagan')}>{t('Ustalarni topish uchun so‘rovingiz qaysi xizmatga tegishli ekanini tanlang. Tanlangach mos ustalar avtomatik qidiriladi.')}</Alert>
      {setService.isError && <Alert tone="danger">{getErrorMessage(setService.error)}</Alert>}
      <ServiceChooser label={t('Xizmat turi')} value={serviceId} onChange={setServiceId} />
      <div>
        <Button disabled={!serviceId} loading={setService.isPending} onClick={() => setService.mutate(serviceId)}>{t('Ustalarni izlash')}</Button>
      </div>
    </div>
  );
}
