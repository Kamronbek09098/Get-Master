import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CASE_STATUS_LABEL, CASE_TYPE_LABEL, caseTitle, caseTone, shortId } from '@/features/dispute/types';
import type { CaseStatus } from '@/features/dispute/types';
import { ArrowLeft, ArrowRight, Check, X, Ban, CheckCircle2, MapPin, MessageSquare, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime, formatMoney } from '@/lib/utils';
import { AccountLink } from '@/features/admin/components/AccountLink';
import { useAdminOrder, useCancelOrder, useResolveOrder } from '@/features/admin/hooks/useAdmin';
import type { PaymentProvider } from '@/types/common';
import type { AdminMediaInfo, AdminOrderDetail, AdminOrderPerson } from '@/features/admin/types';
import { MediaViewer } from '@/features/media/components/MediaViewer';
import { fixFilename, formatBytes, formatMime } from '@/features/media/file-info';
import { OrderStatus } from '@/features/order/components/OrderStatus';
import { STATUS_TEXT } from '@/features/order/order-flow';
import { useConfirmCash } from '@/features/payment/hooks/usePayment';
import { providerLabel } from '@/features/payment/labels';
import { ProviderLogo } from '@/features/payment/components/ProviderLogo';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import './AdminOrderDetailPage.css';
import { t } from '@/i18n';

const REFUND_STATUS: Record<string, string> = { PENDING: t('Kutilmoqda'), PROCESSING: t('Jarayonda'), SUCCEEDED: t('Bajarildi'), FAILED: t('Xatolik'), CANCELLED: t('Bekor qilindi') };
const REFUND_REASON: Record<string, string> = { ADMIN_DECISION: t('Administrator qarori'), ORDER_CANCELLED: t('Buyurtma bekor qilingan'), DISPUTE: t('Nizo natijasi'), CUSTOMER_REQUEST: t('Mijoz so‘rovi') };
const REVIEW_STATUS: Record<string, string> = { PUBLISHED: t('E’lon qilingan'), FLAGGED: t('Shikoyat qilingan'), HIDDEN: t('Yashirilgan'), REMOVED: t('O‘chirilgan') };

const STAGES: Array<{ key: 'BEFORE' | 'DURING' | 'AFTER'; label: string }> = [
  { key: 'BEFORE', label: t('Ishdan oldin') },
  { key: 'DURING', label: t('Ish jarayonida') },
  { key: 'AFTER', label: t('Ishdan keyin') },
];
const ACTOR: Record<string, string> = { CUSTOMER: 'Mijoz', MASTER: 'Usta', ADMIN: 'Administrator', SYSTEM: 'Tizim' };
const PAYMENT: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: t('Kutilmoqda'), tone: 'neutral' },
  PROCESSING: { label: t('Jarayonda'), tone: 'warning' },
  SUCCEEDED: { label: t('To‘langan'), tone: 'success' },
  FAILED: { label: t('Muvaffaqiyatsiz'), tone: 'danger' },
  CANCELLED: { label: t('Bekor qilingan'), tone: 'neutral' },
  REFUNDED: { label: t('Qaytarilgan'), tone: 'warning' },
  PARTIALLY_REFUNDED: { label: t('Qisman qaytarilgan'), tone: 'warning' },
};
const EXTRA: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: t('Javob kutilmoqda'), tone: 'warning' },
  APPROVED: { label: t('Mijoz kelishdi'), tone: 'success' },
  REJECTED: { label: t('Mijoz rad etdi'), tone: 'danger' },
  CANCELLED: { label: t('Bekor qilingan'), tone: 'neutral' },
  EXPIRED: { label: t('Muddati tugagan'), tone: 'neutral' },
};

function Card({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="gm-aordd__card">
      <header>
        <h2>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="gm-aordd__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const DEFAULT_JOB_MINUTES = 60;

function formatWorkMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return t('{hours} soat {minutes} daq', { hours: h, minutes: m });
  return h ? t('{hours} soat', { hours: h }) : t('{minutes} daq', { minutes: m });
}

/** Rejalashtirilgan vaqt va manzil: boshlanish — kelishilgan vaqt, tugash — boshlanish + ustaning taxminiy ish vaqti. */
function ScheduleRows({ order }: { order: AdminOrderDetail }) {
  const { booking } = order;
  const startIso = booking.scheduledStartAt ?? booking.request.preferredStartAt;
  const plannedStart = startIso ? new Date(startIso) : null;
  const estMinutes = booking.offer.estimatedMinutes ?? (plannedStart ? DEFAULT_JOB_MINUTES : null);
  const endIso = booking.scheduledEndAt;
  const plannedEnd = endIso ? new Date(endIso) : plannedStart && estMinutes ? new Date(plannedStart.getTime() + estMinutes * 60_000) : null;
  const snap = booking.locationSnapshot as { latitude?: string | number | null; longitude?: string | number | null; addressLine?: string | null; title?: string | null } | null;
  const a = booking.request.address;
  const lat = snap?.latitude != null ? Number(snap.latitude) : null;
  const lng = snap?.longitude != null ? Number(snap.longitude) : null;
  const coords = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  const addressText = a
    ? [a.city, a.district, a.addressLine].filter(Boolean).join(', ')
    : snap?.addressLine || (coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : t('Xaritada belgilangan nuqta'));
  return (
    <>
      <Row label={t('Rejalashtirilgan boshlanish')}>{plannedStart ? formatDateTime(plannedStart.toISOString()) : <span className="gm-aordd__none">{t('Kelishiladi')}</span>}</Row>
      <Row label={t('Rejalashtirilgan tugash')}>
        {plannedEnd ? (
          <>
            {formatDateTime(plannedEnd.toISOString())}
            {estMinutes ? <span className="gm-aordd__none"> · {formatWorkMinutes(estMinutes)}</span> : null}
          </>
        ) : (
          <span className="gm-aordd__none">{t('Belgilanmagan')}</span>
        )}
      </Row>
      <Row label={t('Manzil')}>
        <MapPin size={13} aria-hidden="true" /> {addressText}
        {coords ? (
          <>
            {' '}
            <a href={`https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=17/${coords.lat}/${coords.lng}`} target="_blank" rel="noreferrer">
              {t('Xaritada ko‘rish')}
            </a>
          </>
        ) : null}
      </Row>
    </>
  );
}

function Party({ role, person, extra }: { role: string; person: AdminOrderPerson; extra?: string }) {
  return (
    <div className="gm-aordd__party">
      <ChatAvatar name={accountName(person)} seed={person.id} size="lg" />
      <div className="gm-aordd__party-body">
        <small className="gm-aordd__party-role">{role}</small>
        <AccountLink accountNumber={person.accountNumber} className="gm-aordd__party-name">
          {accountName(person)}
        </AccountLink>
        <span className="gm-aordd__party-meta">{t('ID {accountNumber} · {phone}', { accountNumber: person.accountNumber, phone: person.phone })}</span>
        {extra && <span className="gm-aordd__party-meta">{extra}</span>}
      </div>
    </div>
  );
}

function FileInfo({ asset }: { asset: AdminMediaInfo | null }) {
  if (!asset) return null;
  return (
    <small className="gm-aordd__file">
      {fixFilename(asset.originalName)} · {formatMime(asset.detectedMimeType ?? '')} · {formatBytes(asset.sizeBytes)}
    </small>
  );
}

function CashConfirm({ paymentId }: { paymentId: string }) {
  const confirm = useConfirmCash();
  return (
    <div>
      {confirm.isError && <Alert tone="danger">{getErrorMessage(confirm.error)}</Alert>}
      <Button size="sm" variant="secondary" loading={confirm.isPending} onClick={() => confirm.mutate(paymentId)}>{t('Naqd pul olinganini tasdiqlash')}</Button>
    </div>
  );
}

function ActionDialog({ order, mode, onClose }: { order: AdminOrderDetail; mode: 'cancel' | 'COMPLETE' | 'CANCEL'; onClose: () => void }) {
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

export function AdminOrderDetailPage() {
  const { id } = useParams();
  const query = useAdminOrder(id);
  const [dialog, setDialog] = useState<'cancel' | 'COMPLETE' | 'CANCEL' | null>(null);
  const order = query.data;

  return (
    <div className="gm-aordd">
      <Link to="/admin/buyurtmalar" className="gm-aordd__back">
        <ArrowLeft size={16} />{' '}{t('Buyurtmalar')}</Link>
      {query.isLoading && <PageLoader />}
      {query.isError && <Alert tone="danger">{getErrorMessage(query.error)}</Alert>}
      {order && (
        <>
          <header className={`gm-aordd__hero gm-aordd__hero--${order.status}`}>
            <div className="gm-aordd__heading">
              <div className="gm-aordd__title">
                <h1>{order.booking.request.title}</h1>
                <OrderStatus status={order.status} />
              </div>
              <p>{t('Buyurtma')}{' '}<strong>№{order.orderNumber}</strong>{' '}{t('(mijozning {customerOrderIndex}-, ustaning {masterOrderIndex}-buyurtmasi) · yaratilgan {dateTime} {p}', { customerOrderIndex: order.customerOrderIndex, masterOrderIndex: order.masterOrderIndex, dateTime: formatDateTime(order.createdAt), p: order.booking.request.category && ` · ${order.booking.request.category.name}` })}</p>
            </div>
            <div className="gm-aordd__actions">
              {order.conversationId && (
                <Link to={`/admin/suhbatlar?suhbat=${order.conversationId}`}>
                  <Button size="sm" variant="secondary">
                    <MessageSquare size={14} />{' '}{t('Suhbatni ko‘rish')}</Button>
                </Link>
              )}
              {order.allowedActions.cancel && (
                <Button size="sm" variant="danger" onClick={() => setDialog('cancel')}>
                  <Ban size={14} />{' '}{t('Bekor qilish')}</Button>
              )}
              {order.allowedActions.resolve && (
                <>
                  <Button size="sm" onClick={() => setDialog('COMPLETE')}>
                    <CheckCircle2 size={14} />{' '}{t('Yakunlash')}</Button>
                  <Button size="sm" variant="danger" onClick={() => setDialog('CANCEL')}>
                    <Ban size={14} />{' '}{t('Bekor qilish')}</Button>
                </>
              )}
            </div>
          </header>

          {order.status === 'DISPUTED' && <Alert tone="warning">{t('Buyurtma bo‘yicha nizo ochilgan. Ishning rasmlari va suhbatni ko‘rib chiqib, qaror qabul qiling.')}</Alert>}
          {order.cancellationReason && <Alert tone="info">{t('Bekor qilish sababi:')}{' '}{order.cancellationReason}</Alert>}

          <section className="gm-aordd__flow" aria-label={t('Holatlar tarixi')}>
            <h2 className="gm-aordd__flow-title">{t('Holatlar tarixi')}</h2>
            <ol className="gm-aordd__steps">
              {order.statusHistory.map((step, index) => {
                const last = index === order.statusHistory.length - 1;
                // Buyurtma yakunlangan yoki bekor qilingan bo‘lsa, oxirgi bosqich «tugallangan» belgisi bilan ko‘rsatiladi.
                const final = last && (order.status === 'COMPLETED' || order.status === 'CANCELLED' || order.status === 'EXPIRED');
                const failed = final && order.status !== 'COMPLETED';
                return (
                  <li key={step.id} className={final ? (failed ? 'is-final is-failed' : 'is-final is-success') : last ? 'is-current' : 'is-done'}>
                    <span className="gm-aordd__steps-dot" aria-hidden="true">
                      {final && (failed ? <X size={10} strokeWidth={4} /> : <Check size={10} strokeWidth={4} />)}
                    </span>
                    <strong className="gm-aordd__steps-title">{STATUS_TEXT[step.newStatus]}</strong>
                    <span className="gm-aordd__steps-who">
                      <b>{ACTOR[step.actorType] ?? step.actorType}</b>
                      {step.actor && <span title={accountName(step.actor)}>{accountName(step.actor)}</span>}
                    </span>
                    {step.reason && step.reason !== 'Offer accepted' && <em>{t('Sabab:')}{' '}{step.reason}</em>}
                    <time dateTime={step.createdAt}>{formatDateTime(step.createdAt)}</time>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="gm-aordd__money" aria-label={t('Summalar')}>
            <div>
              <small>{t('Kelishilgan narx')}</small>
              <strong>{formatMoney(order.originalAmount, order.currency)}</strong>
            </div>
            <div>
              <small>{t('Qo‘shimcha ish')}</small>
              <strong>{formatMoney(order.additionalAmount, order.currency)}</strong>
            </div>
            <div className="gm-aordd__money-main">
              <small>{t('Yakuniy summa')}</small>
              <strong>{formatMoney(order.finalAmount, order.currency)}</strong>
            </div>
            <div>
              <small>{t('Platforma ulushi')}</small>
              <strong>{order.platformFee ? formatMoney(order.platformFee, order.currency) : '—'}</strong>
            </div>
            <div>
              <small>{t('Usta ulushi')}</small>
              <strong>{order.masterAmount ? formatMoney(order.masterAmount, order.currency) : '—'}</strong>
            </div>
          </section>

          <div className="gm-aordd__grid">
            <Card title={t('Tomonlar')}>
              <div className="gm-aordd__parties">
                <Party role="Mijoz" person={order.customer} />
                <Party role={t('Usta')} person={order.master.user} extra={t('{profession} · reyting {rating} · {jobs} ish', { profession: order.master.profession ?? t('Kasb ko‘rsatilmagan'), rating: Number(order.master.ratingAvg).toFixed(1), jobs: order.master.completedOrders })} />
              </div>
            </Card>

            <Card title={t('Jadval va manzil')}>
              <h3 className="gm-aordd__sub">{t('Rejalashtirilgan vaqt')}</h3>
              <dl>
                <ScheduleRows order={order} />
              </dl>
              <h3 className="gm-aordd__sub">{t('Haqiqiy bajarilish')}</h3>
              <dl>
                <Row label={t('Ish boshlangan')}>{order.startedAt ? formatDateTime(order.startedAt) : <span className="gm-aordd__none">{t('Hali yo‘q')}</span>}</Row>
                <Row label={t('Ish topshirilgan')}>{order.completionSubmittedAt ? formatDateTime(order.completionSubmittedAt) : <span className="gm-aordd__none">{t('Hali yo‘q')}</span>}</Row>
                <Row label={t('Yakunlangan')}>{order.completedAt ? formatDateTime(order.completedAt) : <span className="gm-aordd__none">{t('Hali yo‘q')}</span>}</Row>
              </dl>
            </Card>
          </div>

          <Card title={t('Mijoz so‘rovi')}>
            <h3 className="gm-aordd__sub">{t('Muammo tavsifi')}</h3>
            <p className="gm-aordd__text">{order.booking.request.description}</p>
            <h3 className="gm-aordd__sub">{t('Usta taklifi')}</h3>
            <div className="gm-aordd__offer">
              <div className="gm-aordd__tile gm-aordd__tile--price">
                <span>{t('Taklif narxi')}</span>
                <strong>{formatMoney(order.booking.offer.price, order.currency)}</strong>
              </div>
              <div className="gm-aordd__tile">
                <span>{t('Taxminiy ish vaqti')}</span>
                <strong>{order.booking.offer.estimatedMinutes ? formatWorkMinutes(order.booking.offer.estimatedMinutes) : <em className="gm-aordd__none">{t('Belgilanmagan')}</em>}</strong>
              </div>
              <div className="gm-aordd__tile">
                <span>{t('Taklif yuborilgan')}</span>
                <strong>{formatDateTime(order.booking.offer.createdAt)}</strong>
              </div>
            </div>
            {order.booking.offer.message && (
              <div className="gm-aordd__note">
                <span>{t('Usta izohi')}</span>
                <p>{order.booking.offer.message}</p>
              </div>
            )}
            {order.requestAssets.length > 0 && (
              <div className="gm-aordd__gallery" aria-label={t('Mijoz yuklagan rasmlar')}>
                {order.requestAssets.map((asset) => (
                  <figure key={asset.id}>
                    <MediaViewer assetId={asset.id} alt={fixFilename(asset.originalName)} label={fixFilename(asset.originalName)} size="lg" />
                    <FileInfo asset={asset} />
                  </figure>
                ))}
              </div>
            )}
          </Card>

          <Card title={t('Usta yuklagan ish rasmlari')} aside={<Badge tone="primary">{order.workProofs.length} ta</Badge>}>
            {order.workProofs.length === 0 ? (
              <EmptyState title={t('Rasm yuklanmagan')} />
            ) : (
              <div className="gm-aordd__stages">
              {STAGES.map((stage) => {
                const proofs = order.workProofs.filter((proof) => proof.stage === stage.key);
                if (proofs.length === 0) return null;
                return (
                  <div key={stage.key} className="gm-aordd__stage">
                    <h3>
                      {stage.label} <small>{proofs.length} ta</small>
                    </h3>
                    <div className="gm-aordd__gallery">
                      {proofs.map((proof) => (
                        <figure key={proof.id}>
                          {proof.mediaAssetId ? (
                            <MediaViewer assetId={proof.mediaAssetId} alt={stage.label} label={`${stage.label}: ${proof.asset ? fixFilename(proof.asset.originalName) : 'fayl'}`} size="lg" />
                          ) : (
                            <span className="gm-aordd__nofile">{t('Fayl saqlanmagan')}</span>
                          )}
                          <FileInfo asset={proof.asset} />
                          <small>
                            {accountName(proof.uploadedBy)} · {formatDateTime(proof.createdAt)}
                          </small>
                        </figure>
                      ))}
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </Card>

          <div className="gm-aordd__grid">
            <Card title={t('To‘lovlar')} aside={<Badge tone="primary">{order.payments.length} ta</Badge>}>
              {order.payments.length === 0 ? (
                <EmptyState title={t('To‘lov usuli kiritilmagan')} description={order.status === 'COMPLETED' ? t('Mijoz buyurtmani yakunlagan, lekin to‘lov usulini tanlamagan.') : t('Mijoz ishni tasdiqlaganda to‘lov usulini tanlaydi.')} />
              ) : (
                <ul className="gm-aordd__plain">
                  {order.payments.map((payment) => {
                    const info = PAYMENT[payment.status] ?? { label: payment.status, tone: 'neutral' as BadgeTone };
                    return (
                      <li key={payment.id}>
                        <div className="gm-aordd__pay">
                          <ProviderLogo provider={payment.provider as PaymentProvider} size={34} />
                          <span className="gm-aordd__pay-main">
                            <strong>{formatMoney(payment.amount, payment.currency)}</strong>
                            <small>{providerLabel(payment.provider)}</small>
                          </span>
                          <Badge tone={info.tone}>{info.label}</Badge>
                        </div>
                        <small>
                          {formatDateTime(payment.succeededAt ?? payment.createdAt)}
                          {Number(payment.refundedAmount) > 0 && t(' · qaytarilgan {money}', { money: formatMoney(payment.refundedAmount, payment.currency) })}
                          {payment.failureReason && ` · ${payment.failureReason}`}
                        </small>
                        {payment.provider === 'CASH' && payment.status === 'PENDING' && <CashConfirm paymentId={payment.id} />}
                        {payment.refunds.length > 0 && (
                          <ul className="gm-aordd__refunds" aria-label={t('Qaytarishlar')}>
                            {payment.refunds.map((refund) => (
                              <li key={refund.id}>
                                <strong>{formatMoney(refund.amount, payment.currency)}</strong>
                                <span>{REFUND_REASON[refund.reason] ?? refund.reason}</span>
                                <Badge tone={refund.status === 'SUCCEEDED' ? 'success' : refund.status === 'FAILED' ? 'danger' : 'warning'}>{REFUND_STATUS[refund.status] ?? refund.status}</Badge>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          {order.additionalWork.length > 0 && (
            <Card title={t('Qo‘shimcha ish so‘rovlari')}>
              <ul className="gm-aordd__plain">
                {order.additionalWork.map((work) => {
                  const info = EXTRA[work.status] ?? { label: work.status, tone: 'neutral' as BadgeTone };
                  return (
                    <li key={work.id}>
                      <div>
                        <strong>{formatMoney(work.amount, work.currency)}</strong> · {work.reason}
                        <Badge tone={info.tone}>{info.label}</Badge>
                      </div>
                      <small>
                        {work.description} · {accountName(work.requestedBy)} · {formatDateTime(work.requestedAt)}
                      </small>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {(order.review || order.warranty || order.cases.length > 0) && (
            <div className="gm-aordd__grid">
              {order.review && (
                <Card title={t('Mijoz sharhi')} aside={<Badge tone={order.review.status === 'PUBLISHED' ? 'success' : 'warning'}>{REVIEW_STATUS[order.review.status] ?? order.review.status}</Badge>}>
                  <div className="gm-aordd__review">
                    <div className="gm-aordd__review-head">
                      <ChatAvatar name={accountName(order.review.author)} seed={order.review.author?.id ?? order.id} size="md" />
                      <div className="gm-aordd__review-who">
                        <strong>{accountName(order.review.author)}</strong>
                        <time dateTime={order.review.createdAt}>{formatDateTime(order.review.createdAt)}</time>
                      </div>
                      <div className="gm-aordd__review-rate" role="img" aria-label={t('Baho: {rating} / 5', { rating: order.review.rating })}>
                        <span className="gm-aordd__stars" aria-hidden="true">
                          {Array.from({ length: 5 }, (_, index) => (
                            <Star key={index} size={18} fill={index < order.review!.rating ? 'currentColor' : 'none'} />
                          ))}
                        </span>
                        <b>{order.review.rating}/5</b>
                      </div>
                    </div>
                    <blockquote className={order.review.comment ? 'gm-aordd__quote' : 'gm-aordd__quote is-empty'}>{order.review.comment ?? t('Izoh qoldirilmagan.')}</blockquote>
                  </div>
                </Card>
              )}
              {order.warranty && (
                <Card title={t('Kafolat')}>
                  <dl>
                    <Row label={t('Holati')}>{order.warranty.status}</Row>
                    <Row label={t('Boshlanishi')}>{formatDateTime(order.warranty.startsAt)}</Row>
                    <Row label={t('Tugashi')}>{formatDateTime(order.warranty.expiresAt)}</Row>
                  </dl>
                </Card>
              )}
              {order.cases.length > 0 && (
                <Card title={t('Shikoyat va nizolar')}>
                  <ul className="gm-aordd__cases">
                    {order.cases.map((item) => (
                      <li key={item.id} className={`gm-aordd__case gm-aordd__case--${caseTone(item.status)}`}>
                        <div className="gm-aordd__case-top">
                          <span className="gm-aordd__case-type">{CASE_TYPE_LABEL[item.type] ?? item.type} № {shortId(item.id)}</span>
                          <Badge tone={caseTone(item.status) === 'ok' ? 'success' : caseTone(item.status) === 'no' ? 'danger' : 'warning'}>{CASE_STATUS_LABEL[item.status as CaseStatus] ?? item.status}</Badge>
                        </div>
                        <strong className="gm-aordd__case-title">{caseTitle(item.title, order.id)}</strong>
                        <small className="gm-aordd__case-date">{formatDateTime(item.createdAt)}</small>
                      </li>
                    ))}
                  </ul>
                  <Link to={order.cases.some((item) => item.type === 'DISPUTE') ? '/admin/shikoyatlar?kind=disputes' : '/admin/shikoyatlar'} className="gm-aordd__link">{t('Shikoyat va nizolar bo‘limi')} <ArrowRight size={15} aria-hidden="true" /></Link>
                </Card>
              )}
            </div>
          )}
          {dialog && <ActionDialog order={order} mode={dialog} onClose={() => setDialog(null)} />}
        </>
      )}
    </div>
  );
}
