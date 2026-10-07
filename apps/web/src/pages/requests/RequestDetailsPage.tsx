import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Camera, Check, FileText, Hourglass, MapPin, PackageCheck, Send, Wrench } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { getErrorMessage } from '@/lib/error-messages';
import { accountName } from '@/lib/account-name';
import { formatDateTime, formatMoney } from '@/lib/utils';
import { OrderStatus } from '@/features/order/components/OrderStatus';
import { useCancelRequest, useRequest, useSubmitRequest } from '@/features/request/hooks/useRequests';
import { RequestStatus } from '@/features/request/components/RequestStatus';
import { CANCELLABLE_STATUSES, OFFER_ELIGIBLE_STATUSES } from '@/features/request/types';
import { OfferList } from '@/features/offer/components/OfferList';
import { ServicePicker } from '@/features/request/components/ServicePicker';
import { MatchingResults } from '@/features/matching/components/MatchingResults';
import './RequestDetails.css';
import { t } from '@/i18n';

const MIN_REASON = 3;
const STEPS = [
  { key: 'DRAFT', label: t('Qoralama') },
  { key: 'SUBMITTED', label: t('Yuborildi') },
  { key: 'OFFERS_RECEIVED', label: t('Takliflar') },
  { key: 'BOOKED', label: t('Band qilindi') },
] as const;
/** Holatning bosqichdagi o‘rni (MATCHING — «Yuborildi» bosqichi ichida). */
const STEP_INDEX: Record<string, number> = { DRAFT: 0, SUBMITTED: 1, MATCHING: 1, OFFERS_RECEIVED: 2, BOOKED: 3 };

export function RequestDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const request = useRequest(id ?? '');
  const submitRequest = useSubmitRequest(id ?? '');
  const cancelRequest = useCancelRequest(id ?? '');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [shake, setShake] = useState(0);

  const closeCancel = () => {
    setCancelOpen(false);
    setReasonError('');
    cancelRequest.reset();
  };
  const confirmCancel = () => {
    const value = reason.trim();
    if (value.length < MIN_REASON) {
      setReasonError(value.length === 0 ? t('Bekor qilish sababini yozing') : t('Sabab juda qisqa — kamida {min} ta belgi yozing', { min: MIN_REASON }));
      setShake((n) => n + 1);
      return;
    }
    cancelRequest.mutate(value, { onSuccess: () => { closeCancel(); setReason(''); } });
  };

  if (!id) return null;
  if (request.isLoading) return <PageLoader label={t('So‘rov yuklanmoqda…')} />;
  if (request.isError) return <Alert tone="danger">{getErrorMessage(request.error)}</Alert>;
  if (!request.data) return null;

  const data = request.data;
  const canCancel = CANCELLABLE_STATUSES.includes(data.status);
  const stepIndex = STEP_INDEX[data.status];
  const canReceiveOffers = OFFER_ELIGIBLE_STATUSES.includes(data.status);

  return (
    <div className="gm-rqd">
      <Link to="/mijoz/buyurtmalar" className="gm-pay__back gm-rqd__back">
        <ArrowLeft size={16} aria-hidden="true" />{' '}{t('Buyurtmalarga qaytish')}</Link>

      <header className="gm-rqd__hero">
        <div className="gm-rqd__hero-top">
          <h1>{data.title}</h1>
          <RequestStatus status={data.status} />
          <p className="gm-rqd__created">
            <CalendarClock size={14} aria-hidden="true" /> {t('Yaratildi')}: <time dateTime={data.createdAt}>{formatDateTime(data.createdAt)}</time>
          </p>
        </div>
        <div className="gm-rqd__problem">
          <span className="gm-rqd__label">
            <FileText size={14} aria-hidden="true" /> {t('Muammo tavsifi')}
          </span>
          <p className="gm-rqd__desc">{data.description}</p>
        </div>
        <dl className="gm-rqd__facts">
          <div>
            <dt>
              <Wrench size={14} aria-hidden="true" /> {t('Xizmat')}
            </dt>
            <dd className={data.service ? undefined : 'is-empty'}>
              {data.service ? data.service.name : t('Tanlanmagan')}
              {data.category && data.service && <small>{data.category.name}</small>}
            </dd>
          </div>
          <div>
            <dt>
              <MapPin size={14} aria-hidden="true" /> {t('Manzil')}
            </dt>
            <dd className={data.address ? undefined : 'is-empty'}>
              {data.address ? [data.address.city, data.address.district, data.address.addressLine].filter(Boolean).join(', ') : t('Ko‘rsatilmagan')}
              {data.address?.title && <small>{data.address.title}</small>}
            </dd>
          </div>
          <div>
            <dt>
              <CalendarClock size={14} aria-hidden="true" /> {t('Qulay vaqt')}
            </dt>
            <dd className={data.preferredStartAt ? undefined : 'is-empty'}>{data.preferredStartAt ? formatDateTime(data.preferredStartAt) : t('Istalgan vaqt')}</dd>
          </div>
          <div>
            <dt>
              <Camera size={14} aria-hidden="true" /> {t('Rasmlar')}
            </dt>
            <dd className={data._count?.attachments ? undefined : 'is-empty'}>{data._count?.attachments ? `${data._count.attachments} ta` : t('Yuklanmagan')}</dd>
          </div>
          {data.expiresAt && (
            <div>
              <dt>
                <Hourglass size={14} aria-hidden="true" /> {t('Amal qilish muddati')}
              </dt>
              <dd>{formatDateTime(data.expiresAt)}</dd>
            </div>
          )}
        </dl>
        {stepIndex !== undefined && (
          <ol className="gm-rqd__steps" aria-label={t('So‘rov bosqichlari')}>
            {STEPS.map((step, index) => (
              <li key={step.key} className={index < stepIndex ? 'is-done' : index === stepIndex ? 'is-current' : undefined} aria-current={index === stepIndex ? 'step' : undefined}>
                <span className="gm-rqd__dot">{index < stepIndex ? <Check size={13} aria-hidden="true" /> : index + 1}</span>
                <span>{step.label}</span>
              </li>
            ))}
          </ol>
        )}
      </header>

      {(data.status === 'CANCELLED' || data.status === 'EXPIRED') && (
        <Alert tone="warning">
          {data.status === 'EXPIRED' ? t('So‘rovning amal qilish muddati tugagan.') : data.cancellationReason ? `${t('Bekor qilish sababi:')} ${data.cancellationReason}` : t('So‘rov bekor qilingan.')}
        </Alert>
      )}

      {data.status === 'DRAFT' && (
        <div className="gm-detail-section gm-rqd__draft">
          <span className="gm-rqd__draft-icon" aria-hidden="true">
            <Send size={22} />
          </span>
          <div className="gm-rqd__draft-text">
            <h2>{t('Tekshirib chiqing va yuboring')}</h2>
            <p>{t('Yuborganingizdan so‘ng tizim mos ustalarni topadi va ular sizga narx bilan taklif yuboradi.')}</p>
            {submitRequest.isError && <Alert tone="danger">{getErrorMessage(submitRequest.error)}</Alert>}
          </div>
          <Button size="lg" loading={submitRequest.isPending} onClick={() => submitRequest.mutate()}>
            <Send size={16} aria-hidden="true" /> {t('So‘rovni yuborish')}
          </Button>
        </div>
      )}

      {!data.serviceId && data.status !== 'CANCELLED' && data.status !== 'EXPIRED' && data.status !== 'BOOKED' && (
        <div className="gm-detail-section">
          <h2>{t('Xizmat turini tanlang')}</h2>
          <ServicePicker requestId={id} />
        </div>
      )}

      {canReceiveOffers && (
        <div className="gm-detail-section">
          <h2>{t('Takliflar')}</h2>
          <OfferList requestId={id} />
          <aside className="gm-tips gm-rqd__how">
            <h3>{t('Takliflar qanday keladi?')}</h3>
            <ul>
              <li>
                <span>{t('Tizim xizmat turingizga mos, faol va tasdiqlangan ustalarni topadi.')}</span>
              </li>
              <li>
                <span>{t('Reyting, masofa, ish jadvali va oldingi ishlari bo‘yicha ball beradi.')}</span>
              </li>
              <li>
                <span>{t('Eng mos 5 ustaga xabar yuboradi; javob bo‘lmasa 5 daqiqadan keyin keyingi 5 taga (jami 3 marta).')}</span>
              </li>
              <li>
                <span>{t('Ustalar narx va vaqt bilan taklif yuboradi — shu yerda ko‘rinadi, siz tanlaysiz.')}</span>
              </li>
            </ul>
          </aside>
        </div>
      )}

      {data.order && (
        <div className="gm-detail-section">
          <h2>{t('Buyurtma yaratildi')}</h2>
          <div className="gm-card">
            <div className="gm-card__header">
              <h3>
                <PackageCheck size={18} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 6 }} />
                {accountName(data.order.master.user)}
              </h3>
              <OrderStatus status={data.order.status} />
            </div>
            <p className="gm-card__meta">
              {data.order.master.profession ?? t('Usta')}{' '}{t('· ID {accountNumber} · {money}', { accountNumber: data.order.master.user.accountNumber, money: formatMoney(data.order.finalAmount, data.order.currency) })}</p>
            <div style={{ marginTop: 'var(--gm-space-3)' }}>
              <Link to={`/mijoz/buyurtmalar/${data.order.id}`}>
                <Button>{t('Buyurtmani ochish')}</Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {data.status !== 'DRAFT' && data.status !== 'BOOKED' && data.status !== 'CANCELLED' && data.status !== 'EXPIRED' && (
        <div className="gm-detail-section">
          <h2>{t('Mos ustalar')}</h2>
          <MatchingResults requestId={id} serviceSelected={!!data.serviceId} />
        </div>
      )}

      {canCancel && (
        <div className="gm-rqd__danger">
          <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>{t('So‘rovni bekor qilish')}</Button>
          <p>{t('So‘rov kerak bo‘lmay qolgan bo‘lsa, uni bekor qilishingiz mumkin.')}</p>
        </div>
      )}

      <ConfirmDialog
        open={cancelOpen}
        title={t('So‘rovni bekor qilish')}
        description={t('Bekor qilish sababini kiriting:')}
        tone="danger"
        confirmLabel={t('Bekor qilish')}
        loading={cancelRequest.isPending}
        onCancel={closeCancel}
        onConfirm={confirmCancel}
      >
        <Textarea
          key={shake}
          label={t('Sabab')}
          required
          maxLength={500}
          rows={3}
          placeholder={t('Masalan: muammo o‘zi hal bo‘ldi')}
          autoFocus={shake > 0}
          className={reasonError ? 'gm-field__control--shake' : undefined}
          error={reasonError || (cancelRequest.isError ? getErrorMessage(cancelRequest.error) : undefined)}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (reasonError) setReasonError('');
          }}
        />
      </ConfirmDialog>
    </div>
  );
}
