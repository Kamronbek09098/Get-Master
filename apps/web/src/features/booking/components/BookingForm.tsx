import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { newIdempotencyKey } from '@/lib/utils';
import { useAcceptOffer } from '@/features/offer/hooks/useOffers';

export function BookingForm({ offerId }: { offerId: string }) {
  const navigate = useNavigate();
  const acceptOffer = useAcceptOffer();
  const [idempotencyKey] = useState(() => newIdempotencyKey());

  function handleAccept() {
    acceptOffer.mutate(
      { offerId, idempotencyKey },
      {
        onSuccess: (result) => navigate(`/mijozlar/buyurtmalar/${result.order.id}`),
      },
    );
  }

  return (
    <div className="gm-form">
      {acceptOffer.isError && <Alert tone="danger">{getErrorMessage(acceptOffer.error)}</Alert>}
      <p>Taklifni qabul qilsangiz, usta bilan bron yaratiladi.</p>
      <Button onClick={handleAccept} loading={acceptOffer.isPending}>
        Taklifni qabul qilish
      </Button>
    </div>
  );
}
