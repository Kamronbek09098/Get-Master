import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { formatDateTime } from '@/lib/utils';
import type { OpenRequest } from '../types';
import { OfferForm } from './OfferForm';

export function AcceptRequestDialog({ request, onClose }: { request: OpenRequest; onClose: () => void }) {
  const price = request.suggested?.price ? Number(request.suggested.price) : null;

  return (
    <Modal open onClose={onClose} title="So‘rovni qabul qilish">
      <div className="gm-form">
        <div>
          <h3>{request.title}</h3>
          <p className="gm-card__meta">
            {request.service?.name ?? 'Xizmat turi ko‘rsatilmagan'}
            {request.expiresAt && ` · Muddati: ${formatDateTime(request.expiresAt)}`}
          </p>
        </div>
        <Alert tone="info">
          Taklifingiz mijozga yuboriladi. Mijoz sizni tanlasa, buyurtma yaratiladi. Narxni o‘zingiz belgilaysiz
          {price ? ` (xizmat narxingiz asosida to‘ldirildi)` : ''}.
        </Alert>
        <OfferForm
          requestId={request.id}
          initialPrice={price}
          initialMinutes={request.suggested?.estimatedMinutes}
          submitLabel="Qabul qilish va taklif yuborish"
          onDone={onClose}
        />
      </div>
    </Modal>
  );
}
