import { useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Clock, Flag, Hammer, MapPinned, Navigation, ShieldAlert, Star, XCircle } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDateTime } from '@/lib/utils';
import { OrderStatus } from '@/features/order/components/OrderStatus';
import { OrderProgress } from '@/features/order/components/OrderProgress';
import { OrderParty } from '@/features/order/components/OrderParty';
import { OrderTimeline } from '@/features/order/components/OrderTimeline';
import { WorkProofPanel } from '@/features/order/components/WorkProofPanel';
import { OrderPaymentCard } from '@/features/order/components/OrderPaymentCard';
import { PaymentMethodCards } from '@/features/payment/components/PaymentMethodCards';
import type { PaymentProvider } from '@/types/common';
import { ReviewForm } from '@/features/review/components/ReviewForm';
import { AdditionalWorkPanel } from '@/features/work/components/AdditionalWorkPanel';
import {
  useArrive,
  useCancelOrder,
  useConfirmCompletion,
  useConfirmOrder,
  useDisputeOrder,
  useOrder,
  useStartTravel,
  useStartWork,
  useSubmitCompletion,
  useWorkProofs,
} from '@/features/order/hooks/useOrders';
import '@/features/order/components/Order.css';

type DialogKind = 'cancel' | 'dispute' | null;
type Tone = 'next' | 'wait' | 'done' | 'stop';

const BADGE: Record<Tone, string> = { next: 'Sizning navbatingiz', wait: 'Kutilmoqda', done: 'Tayyor', stop: 'To‘xtatilgan' };

function StepCard({ tone, icon, title, lead, children }: { tone: Tone; icon: ReactNode; title: string; lead?: string; children?: ReactNode }) {
  return (
    <section className={cx('gm-ocard', tone === 'next' && 'gm-ocard--next', tone === 'wait' && 'gm-ocard--wait', tone === 'done' && 'gm-ocard--done', tone === 'stop' && 'gm-ocard--stop')}>
      <span className="gm-ocard__badge">{BADGE[tone]}</span>
      <h2 className="gm-ocard__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon} {title}
      </h2>
      {lead && <p className="gm-ocard__lead">{lead}</p>}
      {children}
    </section>
  );
}

export function OrderDetailsPage() {
  const { id = '' } = useParams<{ id: string }>();
  const order = useOrder(id);
  const proofs = useWorkProofs(id);
  const confirmOrder = useConfirmOrder(id);
  const startTravel = useStartTravel(id);
  const arrive = useArrive(id);
  const startWork = useStartWork(id);
  const submitCompletion = useSubmitCompletion(id);
  const confirmCompletion = useConfirmCompletion(id);
  const cancelOrder = useCancelOrder(id);
  const disputeOrder = useDisputeOrder(id);

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<PaymentProvider | ''>('');

  if (order.isLoading) return <PageLoader label="Buyurtma yuklanmoqda…" />;
  if (order.isError) return <Alert tone="danger">{getErrorMessage(order.error)}</Alert>;
  if (!order.data) return null;

  const data = order.data;
  const isMaster = data.viewerRole === 'MASTER';
  const status = data.status;
  const counts = { BEFORE: 0, DURING: 0, AFTER: 0 };
  for (const proof of proofs.data ?? []) if (proof.mediaAssetId) counts[proof.stage] += 1;
  const actionError = [confirmOrder, startTravel, arrive, startWork, submitCompletion, confirmCompletion].find((mutation) => mutation.isError);
  const canCancel = status === 'BOOKED' || status === 'CONFIRMED';
  const canDispute = status === 'IN_PROGRESS' || status === 'WAITING_CONFIRMATION';
  const reasonReady = reason.trim().length >= 3;
  const otherName = isMaster ? 'mijoz' : 'usta';

  function closeDialog() {
    setDialog(null);
    setReason('');
  }

  let step: ReactNode = null;
  if (isMaster) {
    if (status === 'BOOKED')
      step = (
        <StepCard tone="next" icon={<CheckCircle2 size={22} />} title="Buyurtmani tasdiqlang" lead="Mijoz sizni tanladi. Buyurtmani tasdiqlasangiz, mijoz sizning kelishingizni kutadi.">
          <div className="gm-oactions">
            <Button loading={confirmOrder.isPending} onClick={() => confirmOrder.mutate()}>Buyurtmani tasdiqlash</Button>
          </div>
        </StepCard>
      );
    else if (status === 'CONFIRMED')
      step = (
        <StepCard tone="next" icon={<Navigation size={22} />} title="Manzilga yo‘lga chiqing" lead="Yo‘lga chiqqaningizda mijozga xabar boradi.">
          <div className="gm-oactions">
            <Button loading={startTravel.isPending} onClick={() => startTravel.mutate()}>Yo‘lga chiqdim</Button>
          </div>
        </StepCard>
      );
    else if (status === 'ON_THE_WAY')
      step = (
        <StepCard tone="next" icon={<MapPinned size={22} />} title="Manzilga yetib keldingizmi?" lead="Yetib kelganingizni belgilang, so‘ng ishni boshlashdan oldin rasmga oling.">
          <div className="gm-oactions">
            <Button loading={arrive.isPending} onClick={() => arrive.mutate()}>Yetib keldim</Button>
          </div>
        </StepCard>
      );
    else if (status === 'ARRIVED')
      step = (
        <StepCard tone="next" icon={<Hammer size={22} />} title="Ishni boshlashdan oldin" lead="Ishdan oldingi holatni suratga oling. Kamida bitta rasm bo‘lmasa, ishni boshlab bo‘lmaydi.">
          <WorkProofPanel orderId={id} stage="BEFORE" canEdit required />
          <div className="gm-oactions">
            <Button disabled={counts.BEFORE === 0} loading={startWork.isPending} onClick={() => startWork.mutate()}>Ishni boshlash</Button>
          </div>
          {counts.BEFORE === 0 && <p className="gm-oneed">Davom etish uchun kamida 1 ta rasm yuklang.</p>}
        </StepCard>
      );
    else if (status === 'IN_PROGRESS')
      step = (
        <StepCard tone="next" icon={<Hammer size={22} />} title="Ish jarayonida" lead="Ish tugagach, natijani suratga olib, mijozga tasdiqlash uchun yuboring.">
          <WorkProofPanel orderId={id} stage="DURING" canEdit hint="Ixtiyoriy: jarayonni ko‘rsatuvchi rasmlar." />
          <WorkProofPanel orderId={id} stage="AFTER" canEdit required hint="Tayyor natijaning rasmi." />
          <div className="gm-oactions">
            <Button disabled={counts.AFTER === 0} loading={submitCompletion.isPending} onClick={() => submitCompletion.mutate()}>Ish tugadi, mijozga yuborish</Button>
          </div>
          {counts.AFTER === 0 && <p className="gm-oneed">Yuborish uchun ishdan keyingi kamida 1 ta rasm kerak.</p>}
        </StepCard>
      );
    else if (status === 'WAITING_CONFIRMATION')
      step = <StepCard tone="wait" icon={<Clock size={22} />} title="Mijoz tasdig‘i kutilmoqda" lead="Ishni mijoz ko‘rib chiqadi. Tasdiqlangach to‘lov hisobingizga o‘tadi." />;
    else if (status === 'COMPLETED')
      step = <StepCard tone="done" icon={<CheckCircle2 size={22} />} title="Buyurtma yakunlandi" lead="Ish mijoz tomonidan tasdiqlandi. Daromad “Daromad” bo‘limida ko‘rinadi." />;
  } else {
    if (status === 'BOOKED')
      step = <StepCard tone="wait" icon={<Clock size={22} />} title="Usta tasdiqlashini kutmoqda" lead="Usta buyurtmani tasdiqlagach, sizga xabar keladi." />;
    else if (status === 'CONFIRMED')
      step = <StepCard tone="wait" icon={<Clock size={22} />} title="Usta tasdiqladi" lead="Usta yo‘lga chiqqanda xabar olasiz. Chat orqali kelishuv qilishingiz mumkin." />;
    else if (status === 'ON_THE_WAY')
      step = <StepCard tone="wait" icon={<Navigation size={22} />} title="Usta yo‘lda" lead="Usta manzilingizga qarab yo‘lga chiqdi." />;
    else if (status === 'ARRIVED')
      step = <StepCard tone="wait" icon={<MapPinned size={22} />} title="Usta yetib keldi" lead="Usta ishni boshlashga tayyorlanmoqda.">
        <WorkProofPanel orderId={id} stage="BEFORE" />
      </StepCard>;
    else if (status === 'IN_PROGRESS')
      step = <StepCard tone="wait" icon={<Hammer size={22} />} title="Ish jarayonida" lead="Usta ishni bajarmoqda. Tugagach sizdan tasdiq so‘raydi.">
        <WorkProofPanel orderId={id} stage="BEFORE" />
        <WorkProofPanel orderId={id} stage="DURING" />
      </StepCard>;
    else if (status === 'WAITING_CONFIRMATION')
      step = (
        <StepCard tone="next" icon={<CheckCircle2 size={22} />} title="Ishni ko‘rib chiqing" lead="Usta ishni tugatdi. Natijani tekshiring va tasdiqlang. Muammo bo‘lsa, nizo oching.">
          <WorkProofPanel orderId={id} stage="BEFORE" />
          <WorkProofPanel orderId={id} stage="AFTER" />
          <div className="gm-opaypick">
            <h3 className="gm-opaypick__title">To‘lov usulini tanlang <small>(majburiy)</small></h3>
            <PaymentMethodCards value={method} onChange={setMethod} compact />
            {!method && <p className="gm-ocard__lead">Ishni tasdiqlash uchun avval to‘lov usulini tanlang.</p>}
          </div>
          <div className="gm-oactions">
            <Button loading={confirmCompletion.isPending} disabled={!method} onClick={() => method && confirmCompletion.mutate(method)}>Ishni tasdiqlash</Button>
          </div>
        </StepCard>
      );
    else if (status === 'COMPLETED')
      step = (
        <StepCard tone="done" icon={<Star size={22} />} title="Buyurtma yakunlandi" lead="Ustani baholang. Fikringiz boshqa mijozlarga yordam beradi.">
          <ReviewForm orderId={id} />

        </StepCard>
      );
  }
  if (status === 'CANCELLED')
    step = (
      <StepCard tone="stop" icon={<XCircle size={22} />} title="Buyurtma bekor qilindi" lead={data.cancellationReason ? `Sabab: ${data.cancellationReason}` : undefined}>
        {data.cancelledAt && <p className="gm-ocard__lead">{formatDateTime(data.cancelledAt)}</p>}
      </StepCard>
    );
  if (status === 'DISPUTED')
    step = <StepCard tone="stop" icon={<ShieldAlert size={22} />} title="Nizo ko‘rib chiqilmoqda" lead="Administrator ikkala tomonning dalillarini ko‘rib chiqadi. Natija haqida xabar olasiz." />;
  if (status === 'EXPIRED') step = <StepCard tone="stop" icon={<XCircle size={22} />} title="Buyurtma muddati tugadi" />;

  return (
    <div className="gm-opage">
      <div className="gm-ohead">
        <div>
          <h1>{data.request?.title ?? 'Buyurtma'}</h1>
          <p>
            {data.service?.name ?? 'Xizmat'} · Buyurtma #{data.id.slice(0, 8)}
          </p>
        </div>
        <OrderStatus status={status} />
      </div>

      <OrderProgress status={status} />
      {actionError && <Alert tone="danger">{getErrorMessage(actionError.error)}</Alert>}

      <div className="gm-olayout">
        <div className="gm-ocol">
          {step}

          <OrderPaymentCard order={data} />

          {data.request?.description && (
            <section className="gm-ocard">
              <h2 className="gm-ocard__title">Muammo tavsifi</h2>
              <p>{data.request.description}</p>
            </section>
          )}

          <section className="gm-ocard">
            <h2 className="gm-ocard__title">Qo‘shimcha ishlar</h2>
            <AdditionalWorkPanel orderId={id} isMaster={isMaster} canRequest={isMaster && (status === 'ARRIVED' || status === 'IN_PROGRESS')} />
          </section>

          {(canCancel || canDispute) && (
            <section className="gm-ocard">
              <h2 className="gm-ocard__title">Muammo yuz berdimi?</h2>
              <p className="gm-ocard__lead">
                {canCancel ? `Buyurtmani bekor qilsangiz, ${otherName}ga xabar boradi.` : `Ish sifati yoki kelishuv bo‘yicha nizo ochsangiz, administrator ko‘rib chiqadi.`}
              </p>
              <div className="gm-oactions">
                {canCancel && (
                  <Button variant="danger" size="sm" onClick={() => setDialog('cancel')}>
                    <XCircle size={16} /> Bekor qilish
                  </Button>
                )}
                {canDispute && (
                  <Button variant="secondary" size="sm" onClick={() => setDialog('dispute')}>
                    <Flag size={16} /> Nizo ochish
                  </Button>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="gm-ocol">
          <OrderParty order={data} />
          <OrderTimeline orderId={id} />
        </div>
      </div>

      <ConfirmDialog
        open={dialog === 'cancel'}
        title="Buyurtmani bekor qilish"
        description="Bekor qilish sababini yozing. Bu amalni qaytarib bo‘lmaydi."
        confirmLabel="Bekor qilish"
        cancelLabel="Yopish"
        tone="danger"
        loading={cancelOrder.isPending}
        confirmDisabled={!reasonReady}
        onCancel={closeDialog}
        onConfirm={() => cancelOrder.mutate(reason.trim(), { onSuccess: closeDialog })}
      >
        {cancelOrder.isError && <Alert tone="danger">{getErrorMessage(cancelOrder.error)}</Alert>}
        <Textarea label="Sabab" required rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'dispute'}
        title="Nizo ochish"
        description="Nizo sababini batafsil yozing. U administrator ko‘rib chiqishi uchun yuboriladi."
        confirmLabel="Nizo ochish"
        cancelLabel="Yopish"
        loading={disputeOrder.isPending}
        confirmDisabled={!reasonReady}
        onCancel={closeDialog}
        onConfirm={() => disputeOrder.mutate(reason.trim(), { onSuccess: closeDialog })}
      >
        {disputeOrder.isError && <Alert tone="danger">{getErrorMessage(disputeOrder.error)}</Alert>}
        <Textarea label="Sabab" required rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
      </ConfirmDialog>
    </div>
  );
}
