import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, CheckCircle2, ExternalLink, Hammer, MapPinned, Navigation, PackageCheck, XCircle } from 'lucide-react';
import { TravelEtaReporter } from '@/features/order/components/TravelEtaReporter';
import { useArrivalCheck } from '@/features/order/arrival';
import { formatDistance } from '@/features/navigation/geometry';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime, formatMoney } from '@/lib/utils';
import { OrderStatus } from '@/features/order/components/OrderStatus';
import { FLOW_STEPS, stepIndex } from '@/features/order/order-flow';
import { usePaused } from '@/features/master/components/PausedNotice';
import { useArrive, useCancelOrder, useConfirmCompletion, useConfirmOrder, useOrder, useStartTravel, useStartWork, useSubmitCompletion } from '@/features/order/hooks/useOrders';
import { isPaymentSettled } from '@/features/order/payment-state';
import { useConfirmCash } from '@/features/payment/hooks/usePayment';
import { providerLabel } from '@/features/payment/labels';
import { t } from '@/i18n';

/**
 * Chatdagi buyurtma kartasi: buyurtma holati jonli yangilanadi va shu yerning o‘zida
 * usta qabul qiladi, bajaradi; mijoz tasdiqlaydi va to‘lov usulini tanlaydi.
 */
export function ChatOrderCard({ orderId }: { orderId: string }) {
  const query = useOrder(orderId, 8_000);
  const chatPlace = query.data?.location;
  const chatLat = chatPlace?.latitude != null ? Number(chatPlace.latitude) : NaN;
  const chatLon = chatPlace?.longitude != null ? Number(chatPlace.longitude) : NaN;
  const arrivalDest = query.data?.request?.serviceMode !== 'AT_MASTER' && Number.isFinite(chatLat) && Number.isFinite(chatLon) ? { lat: chatLat, lon: chatLon } : null;
  const arrival = useArrivalCheck(arrivalDest, query.data?.viewerRole === 'MASTER' && query.data?.status === 'ON_THE_WAY');
  const confirm = useConfirmOrder(orderId);
  const travel = useStartTravel(orderId);
  const arrive = useArrive(orderId);
  const start = useStartWork(orderId);
  const submit = useSubmitCompletion(orderId);
  const complete = useConfirmCompletion(orderId);
  const cancel = useCancelOrder(orderId);
  const cash = useConfirmCash();
  const paused = usePaused();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (query.isLoading) return <Skeleton style={{ height: 120, width: 300, borderRadius: 12 }} />;
  if (query.isError || !query.data) return <div className="gm-ochat gm-ochat--error">{t('Buyurtmani ochib bo‘lmadi')}</div>;

  const order = query.data;
  const master = order.viewerRole === 'MASTER';
  const atMaster = order.request?.serviceMode === 'AT_MASTER';
  const status = order.status;
  const index = stepIndex(status);
  const percent = status === 'COMPLETED' ? 100 : index >= 0 ? Math.round(((index + 1) / FLOW_STEPS.length) * 100) : 0;
  const link = `${master ? '/usta' : '/mijoz'}/buyurtmalar/${order.id}`;
  const error = [confirm, travel, arrive, start, submit, complete, cancel, cash].find((mutation) => mutation.isError)?.error;
  const busy = [confirm, travel, arrive, start, submit, complete, cash].some((mutation) => mutation.isPending);
  const canCancel = status === 'BOOKED' || status === 'CONFIRMED';
  const payment = order.payment;

  let hint = '';
  const actions: Array<{ label: string; icon: JSX.Element; run: () => void; primary?: boolean; disabled?: boolean }> = [];
  if (master) {
    if (status === 'BOOKED') {
      hint = t('Mijoz sizga buyurtma yubordi. Qabul qilasizmi?');
      if (paused) hint = t('Pauza rejimida buyurtmani qabul qila olmaysiz. Avval pauzani o‘chiring.');
      actions.push({ label: t('Qabul qilish'), icon: <CheckCircle2 size={15} />, run: () => confirm.mutate(), primary: true, disabled: paused });
    } else if (status === 'CONFIRMED' && atMaster) {
      hint = t('Buyurtma qabul qilindi. Mijoz kelganda belgilang.');
      actions.push({ label: t('Mijoz keldi'), icon: <MapPinned size={15} />, run: () => arrive.mutate(), primary: true });
    } else if (status === 'CONFIRMED') {
      hint = t('Buyurtma qabul qilindi. Tayyor bo‘lgach, yo‘lga chiqing.');
      actions.push({ label: t('Yo‘lga chiqdim'), icon: <Navigation size={15} />, run: () => travel.mutate(), primary: true });
    } else if (status === 'ON_THE_WAY') {
      hint = arrivalDest
        ? arrival.state === 'near' ? t('Mijoz sizni kutmoqda.') : arrival.state === 'far' ? t('Manzilgacha taxminan {distance} qoldi. Manzilga yetib borgach tugma faollashadi.', { distance: formatDistance(arrival.distanceM ?? 0) }) : arrival.state === 'locating' ? t('Joylashuvingiz aniqlanmoqda…') : t('Yetib kelganingizni belgilash uchun joylashuvga (GPS) ruxsat bering.')
        : t('Mijoz sizni kutmoqda.');
      actions.push({ label: t('Yetib keldim'), icon: <MapPinned size={15} />, run: () => arrive.mutate(arrival.coords ?? undefined), primary: true, disabled: !!arrivalDest && arrival.state !== 'near' });
    } else if (status === 'ARRIVED') {
      const tooEarly = !!order.scheduledStartAt && new Date(order.scheduledStartAt).getTime() > Date.now();
      hint = tooEarly ? t('Ish belgilangan vaqtdan ({dateTime}) oldin boshlanmaydi.', { dateTime: formatDateTime(order.scheduledStartAt!) }) : t('Ishni boshlash uchun tayyor bo‘lsangiz, boshlang.');
      actions.push({ label: t('Ishni boshlash'), icon: <Hammer size={15} />, run: () => start.mutate(), primary: true, disabled: tooEarly });
    } else if (status === 'IN_PROGRESS') {
      hint = t('Ish tugagach, mijozga tasdiqlash uchun yuboring. Rasmlarni buyurtma sahifasidan yuklang.');
      actions.push({ label: t('Ishni tugatdim'), icon: <CheckCircle2 size={15} />, run: () => submit.mutate(), primary: true });
    } else if (status === 'WAITING_CONFIRMATION') {
      if (payment?.provider === 'CASH' && payment.status === 'PENDING') {
        hint = t('Mijoz naqd pul bilan to‘laydi. Pulni olgach, tasdiqlang — shundan keyin mijoz ishni tasdiqlaydi.');
        actions.push({ label: t('Naqd pulni qabul qildim'), icon: <Banknote size={15} />, run: () => cash.mutate(payment.id), primary: true });
      } else hint = isPaymentSettled(payment) ? t('To‘lov qabul qilindi. Mijoz ishni tasdiqlashini kuting.') : t('Mijoz to‘lovni amalga oshirishi va ishni tasdiqlashi kutilmoqda.');
    } else if (status === 'COMPLETED' && payment?.provider === 'CASH' && payment.status === 'PENDING') {
      hint = t('Mijoz naqd pul bilan to‘laydi. Pulni olgach, tasdiqlang.');
      actions.push({ label: t('Naqd pulni qabul qildim'), icon: <Banknote size={15} />, run: () => cash.mutate(payment.id), primary: true });
    } else if (status === 'COMPLETED') hint = t('Buyurtma yakunlandi.');
  } else if (status === 'BOOKED') hint = t('Usta buyurtmani qabul qilishini kuting.');
  else if (status === 'CONFIRMED') hint = atMaster ? t('Usta buyurtmani qabul qildi. Belgilangan vaqtda ustaning joyiga boring.') : t('Usta buyurtmani qabul qildi.');
  else if (status === 'ON_THE_WAY') hint = t('Usta yo‘lda.');
  else if (status === 'ARRIVED') hint = t('Usta yetib keldi.');
  else if (status === 'IN_PROGRESS') hint = t('Ish jarayonida');
  else if (status === 'WAITING_CONFIRMATION') hint = isPaymentSettled(payment) ? t('To‘lov qabul qilindi. Natijani tekshirib, ishni tasdiqlang.') : t('Usta ishni tugatdi. Ishni tasdiqlash uchun avval to‘lovni to‘liq amalga oshiring.');
  else if (status === 'COMPLETED') hint = payment ? t('Yakunlandi. To‘lov: {providerLabel}.', { providerLabel: providerLabel(payment.provider) }) : t('Yakunlandi. To‘lov usulini buyurtma sahifasida tanlang.');

  return (
    <div className="gm-ochat">
      <div className="gm-ochat__head">
        <span className="gm-ochat__icon" aria-hidden="true">
          <PackageCheck size={18} />
        </span>
        <div>
          <strong>{order.request?.title ?? t('Buyurtma')}</strong>
          <small>{t('Buyurtma №{orderNumber} · {accountName}', { orderNumber: order.orderNumber, accountName: accountName(order.counterpart) })}</small>
        </div>
        <OrderStatus status={status} />
      </div>
      {order.request?.description && <p className="gm-ochat__text">{order.request.description}</p>}
      <div className="gm-ochat__facts">
        <span>{formatMoney(order.finalAmount, order.currency)}</span>
        {order.scheduledStartAt && <span>{formatDateTime(order.scheduledStartAt)}</span>}
      </div>
      {index >= 0 && (
        <div className="gm-ochat__bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${percent}%` }} />
        </div>
      )}
      {status === 'CANCELLED' ? <p className="gm-ochat__hint gm-ochat__hint--bad">{t('Buyurtma bekor qilindi')}{order.cancellationReason ? `: ${order.cancellationReason}` : ''}</p> : hint && <p className="gm-ochat__hint">{hint}</p>}

      {error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
      {master && status === 'ON_THE_WAY' && arrivalDest && <TravelEtaReporter orderId={orderId} dest={arrivalDest} />}

      <div className="gm-ochat__actions">
        {!master && status === 'WAITING_CONFIRMATION' && !isPaymentSettled(payment) && (
          <Link to={`${link}#tolov`}>
            <Button size="sm"><Banknote size={15} />{' '}{t('To‘lovni amalga oshirish')}</Button>
          </Link>
        )}
        {!master && status === 'WAITING_CONFIRMATION' && (
          <Button size="sm" loading={complete.isPending} disabled={!isPaymentSettled(payment) || busy} title={isPaymentSettled(payment) ? undefined : t('Avval to‘lovni to‘liq amalga oshiring')} onClick={() => complete.mutate()}>
            <CheckCircle2 size={15} />{' '}{t('Ishni tasdiqlash')}</Button>
        )}
        {actions.map((action) => (
          <Button key={action.label} size="sm" loading={busy} disabled={action.disabled || busy} onClick={action.run}>
            {action.icon} {action.label}
          </Button>
        ))}
        {canCancel && (
          <Button size="sm" variant="danger" onClick={() => setCancelOpen(true)}>
            <XCircle size={15} /> {master && status === 'BOOKED' ? t('Rad etish') : t('Bekor qilish')}
          </Button>
        )}
        <Link to={link} className="gm-ochat__more">
          <ExternalLink size={14} />{' '}{t('Batafsil')}</Link>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title={master && status === 'BOOKED' ? t('Buyurtmani rad etish') : t('Buyurtmani bekor qilish')}
        description={t('Sababini yozing. Bu amalni qaytarib bo‘lmaydi.')}
        confirmLabel={master && status === 'BOOKED' ? t('Rad etish') : t('Bekor qilish')}
        cancelLabel={t('Yopish')}
        tone="danger"
        loading={cancel.isPending}
        confirmDisabled={reason.trim().length < 3}
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => cancel.mutate(reason.trim(), { onSuccess: () => { setCancelOpen(false); setReason(''); } })}
      >
        {cancel.isError && <Alert tone="danger">{getErrorMessage(cancel.error)}</Alert>}
        <Textarea label={t('Sabab')} required rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
      </ConfirmDialog>
    </div>
  );
}
