import { usePaused } from '@/features/master/components/PausedNotice';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, Flag, Hammer, MapPinned, Navigation, ShieldAlert, Star, Store, XCircle } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDateTime } from '@/lib/utils';
import { OrderStatus } from '@/features/order/components/OrderStatus';
import { OrderProgress } from '@/features/order/components/OrderProgress';
import { OrderStory } from '@/features/order/components/OrderStory';
import { OrderParty } from '@/features/order/components/OrderParty';
import { ScheduleCard } from '@/features/order/components/ScheduleCard';
import { WorkProofPanel } from '@/features/order/components/WorkProofPanel';
import { OrderPaymentCard } from '@/features/order/components/OrderPaymentCard';
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
import { t } from '@/i18n';

type DialogKind = 'cancel' | 'dispute' | null;
type Tone = 'next' | 'wait' | 'done' | 'stop';

const BADGE: Record<Tone, string> = { next: t('Sizning navbatingiz'), wait: t('Kutilmoqda'), done: t('Tayyor'), stop: t('To‘xtatilgan') };

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
  const paused = usePaused();
  const startTravel = useStartTravel(id);
  const arrive = useArrive(id);
  const startWork = useStartWork(id);
  const submitCompletion = useSubmitCompletion(id);
  const confirmCompletion = useConfirmCompletion(id);
  const cancelOrder = useCancelOrder(id);
  const disputeOrder = useDisputeOrder(id);

  const { hash } = useLocation();
  const loaded = !!order.data;
  // Bildirishnomadan «#tolov» bilan kelinsa, to‘lov kartasiga tushamiz.
  useEffect(() => {
    if (hash !== '#tolov' || !loaded) return;
    window.setTimeout(() => document.getElementById('tolov')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
  }, [hash, loaded]);

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<PaymentProvider | ''>('');

  if (order.isLoading) return <PageLoader label={t('Buyurtma yuklanmoqda…')} />;
  if (order.isError) return <Alert tone="danger">{getErrorMessage(order.error)}</Alert>;
  if (!order.data) return null;

  const data = order.data;
  const isMaster = data.viewerRole === 'MASTER';
  // Mijoz ustaning oldiga boradi (sartaroshxona, avtoservis…): «yo‘lda» bosqichi yo‘q.
  const atMaster = data.request?.serviceMode === 'AT_MASTER';
  const placeLine = data.location?.addressLine ?? null;
  const status = data.status;
  const counts = { BEFORE: 0, DURING: 0, AFTER: 0 };
  for (const proof of proofs.data ?? []) if (proof.mediaAssetId) counts[proof.stage] += 1;
  const actionError = [confirmOrder, startTravel, arrive, startWork, submitCompletion, confirmCompletion].find((mutation) => mutation.isError);
  const canCancel = status === 'BOOKED' || status === 'CONFIRMED';
  const canDispute = status === 'IN_PROGRESS' || status === 'WAITING_CONFIRMATION';
  const reasonReady = reason.trim().length >= 3;
  const otherName = isMaster ? 'mijoz' : 'usta';
  const tooEarly = !!data.scheduledStartAt && new Date(data.scheduledStartAt).getTime() > Date.now();

  function closeDialog() {
    setDialog(null);
    setReason('');
  }

  let step: ReactNode = null;
  if (isMaster) {
    if (status === 'BOOKED')
      step = (
        <StepCard tone="next" icon={<CheckCircle2 size={22} />} title={t('Buyurtmani tasdiqlang')} lead={paused ? t('Pauza rejimida buyurtmani qabul qila olmaysiz. Avval pauzani o‘chiring.') : t('Mijoz sizni tanladi. Buyurtmani tasdiqlasangiz, mijoz sizning kelishingizni kutadi.')}>
          <div className="gm-oactions">
            <Button loading={confirmOrder.isPending} disabled={paused} onClick={() => confirmOrder.mutate()}>{t('Buyurtmani tasdiqlash')}</Button>
          </div>
        </StepCard>
      );
    else if (status === 'CONFIRMED' && atMaster)
      step = (
        <StepCard tone="next" icon={<MapPinned size={22} />} title={t('Mijozni kutib oling')} lead={t('Mijoz sizning joyingizga keladi. Mijoz kelganda quyidagi tugmani bosing.')}>
          <div className="gm-oactions">
            <Button loading={arrive.isPending} onClick={() => arrive.mutate()}>{t('Mijoz keldi')}</Button>
          </div>
        </StepCard>
      );
    else if (status === 'CONFIRMED')
      step = (
        <StepCard tone="next" icon={<Navigation size={22} />} title={t('Manzilga yo‘lga chiqing')} lead={t('Yo‘lga chiqqaningizda mijozga xabar boradi.')}>
          <div className="gm-oactions">
            <Button loading={startTravel.isPending} onClick={() => startTravel.mutate()}>{t('Yo‘lga chiqdim')}</Button>
          </div>
        </StepCard>
      );
    else if (status === 'ON_THE_WAY')
      step = (
        <StepCard tone="next" icon={<MapPinned size={22} />} title={t('Manzilga yetib keldingizmi?')} lead={t('Yetib kelganingizni belgilang, so‘ng ishni boshlashdan oldin rasmga oling.')}>
          <div className="gm-oactions">
            <Button loading={arrive.isPending} onClick={() => arrive.mutate()}>{t('Yetib keldim')}</Button>
          </div>
        </StepCard>
      );
    else if (status === 'ARRIVED')
      step = (
        <StepCard tone="next" icon={<Hammer size={22} />} title={t('Ishni boshlashdan oldin')} lead={t('Ishdan oldingi holatni suratga oling. Kamida bitta rasm bo‘lmasa, ishni boshlab bo‘lmaydi.')}>
          <WorkProofPanel orderId={id} stage="BEFORE" canEdit required />
          <div className="gm-oactions">
            <Button disabled={counts.BEFORE === 0 || tooEarly} loading={startWork.isPending} onClick={() => startWork.mutate()}>{t('Ishni boshlash')}</Button>
          </div>
          {counts.BEFORE === 0 && <p className="gm-oneed">{t('Davom etish uchun kamida 1 ta rasm yuklang.')}</p>}
          {tooEarly && data.scheduledStartAt && (
            <p className="gm-oneed">{t('Ish belgilangan vaqtdan ({dateTime}) oldin boshlanmaydi. Vaqt kelishinmasa, pastdagi «Belgilangan vaqt» bo‘limidan yangisini taklif qiling.', { dateTime: formatDateTime(data.scheduledStartAt) })}</p>
          )}
        </StepCard>
      );
    else if (status === 'IN_PROGRESS')
      step = (
        <StepCard tone="next" icon={<Hammer size={22} />} title={t('Ish jarayonida')} lead={t('Ish tugagach, natijani suratga olib, mijozga tasdiqlash uchun yuboring.')}>
          <WorkProofPanel orderId={id} stage="DURING" canEdit hint={t('Ixtiyoriy: jarayonni ko‘rsatuvchi rasmlar')} />
          <WorkProofPanel orderId={id} stage="AFTER" canEdit required hint={t('Tayyor natijaning rasmi')} />
          <div className="gm-oactions">
            <Button disabled={counts.AFTER === 0} loading={submitCompletion.isPending} onClick={() => submitCompletion.mutate()}>{t('Ish tugadi, mijozga yuborish')}</Button>
          </div>
          {counts.AFTER === 0 && <p className="gm-oneed">{t('Yuborish uchun ishdan keyingi kamida 1 ta rasm kerak.')}</p>}
        </StepCard>
      );
    else if (status === 'WAITING_CONFIRMATION')
      step = <StepCard tone="wait" icon={<Clock size={22} />} title={t('Mijoz tasdig‘i kutilmoqda')} lead={t('Ishni mijoz ko‘rib chiqadi. Tasdiqlangach to‘lov hisobingizga o‘tadi.')} />;
    else if (status === 'COMPLETED')
      step = <StepCard tone="done" icon={<CheckCircle2 size={22} />} title={t('Buyurtma yakunlandi')} lead={t('Ish mijoz tomonidan tasdiqlandi. Daromad “Daromad” bo‘limida ko‘rinadi.')} />;
  } else {
    if (status === 'BOOKED')
      step = <StepCard tone="wait" icon={<Clock size={22} />} title={t('Usta tasdiqlashini kutmoqda')} lead={t('Usta buyurtmani tasdiqlagach, sizga xabar keladi.')} />;
    else if (status === 'CONFIRMED')
      step = <StepCard tone="wait" icon={<Clock size={22} />} title={t('Usta tasdiqladi')} lead={atMaster ? t('Belgilangan vaqtda ustaning joyiga boring. Chat orqali kelishuv qilishingiz mumkin.') : t('Usta yo‘lga chiqqanda xabar olasiz. Chat orqali kelishuv qilishingiz mumkin.')} />;
    else if (status === 'ON_THE_WAY')
      step = <StepCard tone="wait" icon={<Navigation size={22} />} title={t('Usta yo‘lda')} lead={t('Usta manzilingizga qarab yo‘lga chiqdi.')} />;
    else if (status === 'ARRIVED')
      step = <StepCard tone="wait" icon={<MapPinned size={22} />} title={atMaster ? t('Siz yetib keldingiz') : t('Usta yetib keldi')} lead={atMaster ? t('Usta ishni boshlashga tayyorlanmoqda.') : t('Usta ishni boshlashga tayyorlanmoqda.')}>
        <WorkProofPanel orderId={id} stage="BEFORE" />
      </StepCard>;
    else if (status === 'IN_PROGRESS')
      step = <StepCard tone="wait" icon={<Hammer size={22} />} title={t('Ish jarayonida')} lead={t('Usta ishni bajarmoqda. Tugagach sizdan tasdiq so‘raydi.')}>
        <WorkProofPanel orderId={id} stage="BEFORE" />
        <WorkProofPanel orderId={id} stage="DURING" />
      </StepCard>;
    else if (status === 'WAITING_CONFIRMATION') {
      // Mijoz to‘lov usulini avval tanlagan bo‘lsa (kutilayotgan to‘lov bor), o‘sha usul oldindan tanlangan turadi — qayta tanlash shart emas.
      const existing = data.payment && data.payment.status !== 'FAILED' && data.payment.status !== 'CANCELLED' ? data.payment.provider : '';
      const chosen: PaymentProvider | '' = method || existing;
      step = (
        <StepCard tone="next" icon={<CheckCircle2 size={22} />} title={t('Ishni ko‘rib chiqing')} lead={t('Usta ishni tugatdi. Natijani tekshiring va tasdiqlang. Muammo bo‘lsa, nizo oching.')}>
          <WorkProofPanel orderId={id} stage="BEFORE" />
          <WorkProofPanel orderId={id} stage="AFTER" />
          {!chosen && (
            <p className="gm-ocard__lead">{t('Ishni tasdiqlash uchun avval pastdagi')}{' '}<a href="#tolov">{t('«To‘lov» kartasida')}</a>{' '}{t('to‘lov usulini tanlang.')}</p>
          )}
          <div className="gm-oactions">
            <Button loading={confirmCompletion.isPending} disabled={!chosen} onClick={() => chosen && confirmCompletion.mutate(chosen)}>{t('Ishni tasdiqlash')}</Button>
          </div>
        </StepCard>
      );
    } else if (status === 'COMPLETED')
      step = (
        <StepCard tone="done" icon={<Star size={22} />} title={t('Buyurtma yakunlandi')} lead={data.review ? undefined : t('Ustani baholang. Fikringiz boshqa mijozlarga yordam beradi.')}>
          <ReviewForm orderId={id} existing={data.review} />

        </StepCard>
      );
  }
  if (status === 'CANCELLED')
    step = (
      <StepCard tone="stop" icon={<XCircle size={22} />} title={t('Buyurtma bekor qilindi')} lead={data.cancellationReason ? t('Sabab: {cancellationReason}', { cancellationReason: data.cancellationReason }) : undefined}>
        {data.cancelledAt && <p className="gm-ocard__lead">{formatDateTime(data.cancelledAt)}</p>}
      </StepCard>
    );
  if (status === 'DISPUTED')
    step = <StepCard tone="stop" icon={<ShieldAlert size={22} />} title={t('Nizo ko‘rib chiqilmoqda')} lead={t('Administrator ikkala tomonning dalillarini ko‘rib chiqadi. Natija haqida xabar olasiz.')} />;
  if (status === 'EXPIRED') step = <StepCard tone="stop" icon={<XCircle size={22} />} title={t('Buyurtma muddati tugadi')} />;

  return (
    <div className="gm-opage">
      <div className="gm-ohead">
        <div>
          <h1>{data.request?.title ?? t('Buyurtma')}</h1>
          <p>
            {data.service?.name ?? t('Xizmat')}{' '}{t('· Buyurtma №{orderNumber}', { orderNumber: data.orderNumber })}</p>
        </div>
        <OrderStatus status={status} />
      </div>

      <OrderProgress status={status} orderId={id} atMaster={atMaster} />
      {actionError && <Alert tone="danger">{getErrorMessage(actionError.error)}</Alert>}

      <OrderStory data={data} proofs={proofs.data} loading={proofs.isLoading} />

      <div className="gm-olayout">
        <div className="gm-ocol">
          {step}

          {atMaster && placeLine && status !== 'CANCELLED' && status !== 'EXPIRED' && (
            <section className="gm-ocard">
              <h2 className="gm-ocard__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Store size={20} /> {t('Uchrashuv joyi')}</h2>
              <p className="gm-ocard__lead">{isMaster ? t('Mijoz sizning joyingizga keladi:') : t('Ustaning manzili:')}</p>
              <p><strong>{data.location?.title ? `${data.location.title}, ` : ''}{placeLine}</strong></p>
            </section>
          )}

          <ScheduleCard order={data} />

          <OrderPaymentCard order={data} selectedMethod={method} onSelectMethod={setMethod} />

          <section className="gm-ocard">
            <h2 className="gm-ocard__title">{t('Qo‘shimcha ishlar')}</h2>
            <AdditionalWorkPanel orderId={id} isMaster={isMaster} canRequest={isMaster && (status === 'ARRIVED' || status === 'IN_PROGRESS')} />
          </section>

          {(canCancel || canDispute) && (
            <section className="gm-ocard">
              <h2 className="gm-ocard__title">{t('Muammo yuz berdimi?')}</h2>
              <p className="gm-ocard__lead">
                {canCancel ? t('Buyurtmani bekor qilsangiz, {otherName}ga xabar boradi.', { otherName }) : t('Ish sifati yoki kelishuv bo‘yicha nizo ochsangiz, administrator ko‘rib chiqadi.')}
              </p>
              <div className="gm-oactions">
                {canCancel && (
                  <Button variant="danger" size="sm" onClick={() => setDialog('cancel')}>
                    <XCircle size={16} />{' '}{t('Bekor qilish')}</Button>
                )}
                {canDispute && (
                  <Button variant="secondary" size="sm" onClick={() => setDialog('dispute')}>
                    <Flag size={16} />{' '}{t('Nizo ochish')}</Button>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="gm-ocol">
          <OrderParty order={data} />
        </div>
      </div>

      <ConfirmDialog
        open={dialog === 'cancel'}
        title={t('Buyurtmani bekor qilish')}
        description={t('Bekor qilish sababini yozing. Bu amalni qaytarib bo‘lmaydi.')}
        confirmLabel={t('Bekor qilish')}
        cancelLabel={t('Yopish')}
        tone="danger"
        loading={cancelOrder.isPending}
        confirmDisabled={!reasonReady}
        onCancel={closeDialog}
        onConfirm={() => cancelOrder.mutate(reason.trim(), { onSuccess: closeDialog })}
      >
        {cancelOrder.isError && <Alert tone="danger">{getErrorMessage(cancelOrder.error)}</Alert>}
        <Textarea label={t('Sabab')} required rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'dispute'}
        title={t('Nizo ochish')}
        description={t('Nizo sababini batafsil yozing. U administrator ko‘rib chiqishi uchun yuboriladi.')}
        confirmLabel={t('Nizo ochish')}
        cancelLabel={t('Yopish')}
        loading={disputeOrder.isPending}
        confirmDisabled={!reasonReady}
        onCancel={closeDialog}
        onConfirm={() => disputeOrder.mutate(reason.trim(), { onSuccess: closeDialog })}
      >
        {disputeOrder.isError && <Alert tone="danger">{getErrorMessage(disputeOrder.error)}</Alert>}
        <Textarea label={t('Sabab')} required rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
      </ConfirmDialog>
    </div>
  );
}
