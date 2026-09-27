import { useState } from 'react';
import { CalendarClock, CheckCircle2, XCircle } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/utils';
import { useAcceptReschedule, useDeclineReschedule, useProposeReschedule } from '../hooks/useOrders';
import type { OrderDetailsData } from '../types';

const RESCHEDULABLE = new Set(['BOOKED', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED']);

/** «datetime-local» maydoni uchun hozirgi mahalliy vaqt (YYYY-MM-DDTHH:mm): undan oldingi vaqtni tanlab bo‘lmaydi. */
const nowLocal = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

function ProposeDialog({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const propose = useProposeReschedule(orderId);
  const [when, setWhen] = useState('');
  const inPast = !!when && new Date(when).getTime() <= Date.now();
  const valid = !!when && !inPast;

  return (
    <Modal
      open
      onClose={propose.isPending ? () => undefined : onClose}
      title="Yangi vaqt taklif qilish"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={propose.isPending}>
            Bekor qilish
          </Button>
          <Button loading={propose.isPending} disabled={!valid} onClick={() => propose.mutate(new Date(when).toISOString(), { onSuccess: onClose })}>
            Taklif yuborish
          </Button>
        </>
      }
    >
      <div className="gm-form">
        <Alert tone="info">Ikkinchi tomon tasdiqlaguncha yangi vaqt kuchga kirmaydi.</Alert>
        {propose.isError && <Alert tone="danger">{getErrorMessage(propose.error)}</Alert>}
        <Input
          label="Yangi sana va vaqt"
          type="datetime-local"
          min={nowLocal()}
          value={when}
          error={inPast ? 'O‘tgan vaqtni tanlab bo‘lmaydi' : undefined}
          onChange={(event) => setWhen(event.target.value)}
        />
      </div>
    </Modal>
  );
}

/** Buyurtmaning belgilangan vaqtini ko‘rsatadi va mijoz/usta kelishib uni o‘zgartirishiga imkon beradi. */
export function ScheduleCard({ order }: { order: OrderDetailsData }) {
  const [proposing, setProposing] = useState(false);
  const accept = useAcceptReschedule(order.id);
  const decline = useDeclineReschedule(order.id);
  const canReschedule = RESCHEDULABLE.has(order.status);
  const error = accept.error ?? decline.error;

  if (!order.scheduledStartAt && !order.reschedule && !canReschedule) return null;

  return (
    <section className="gm-ocard">
      <h2 className="gm-ocard__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <CalendarClock size={20} /> Belgilangan vaqt
      </h2>
      <p className="gm-ocard__lead">{order.scheduledStartAt ? formatDateTime(order.scheduledStartAt) : 'Vaqt belgilanmagan'}</p>
      {error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}

      {order.reschedule ? (
        order.reschedule.proposedByMe ? (
          <Alert tone="warning">
            Siz yangi vaqt taklif qildingiz: <strong>{formatDateTime(order.reschedule.proposedStartAt)}</strong>. {accountName(order.counterpart)} tasdiqlashini kutmoqda.
          </Alert>
        ) : (
          <Alert tone="warning">
            <p style={{ margin: '0 0 10px' }}>
              {accountName(order.counterpart)} yangi vaqt taklif qildi: <strong>{formatDateTime(order.reschedule.proposedStartAt)}</strong>.
            </p>
            <div className="gm-oactions">
              <Button size="sm" loading={accept.isPending} onClick={() => accept.mutate()}>
                <CheckCircle2 size={15} /> Qabul qilish
              </Button>
              <Button size="sm" variant="secondary" loading={decline.isPending} onClick={() => decline.mutate()}>
                <XCircle size={15} /> Rad etish
              </Button>
            </div>
          </Alert>
        )
      ) : (
        canReschedule && (
          <div className="gm-oactions">
            <Button size="sm" variant="secondary" onClick={() => setProposing(true)}>
              <CalendarClock size={15} /> Vaqtni o‘zgartirish
            </Button>
          </div>
        )
      )}

      {proposing && <ProposeDialog orderId={order.id} onClose={() => setProposing(false)} />}
    </section>
  );
}
