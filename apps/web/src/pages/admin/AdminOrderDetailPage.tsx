import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Ban, CheckCircle2, MapPin, MessageSquare, Star } from 'lucide-react';
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
import type { AdminMediaInfo, AdminOrderDetail, AdminOrderPerson } from '@/features/admin/types';
import { MediaViewer } from '@/features/media/components/MediaViewer';
import { fixFilename, formatBytes, formatMime } from '@/features/media/file-info';
import { OrderStatus } from '@/features/order/components/OrderStatus';
import { STATUS_TEXT } from '@/features/order/order-flow';
import { useConfirmCash } from '@/features/payment/hooks/usePayment';
import { providerLabel } from '@/features/payment/labels';
import './AdminOrderDetailPage.css';

const STAGES: Array<{ key: 'BEFORE' | 'DURING' | 'AFTER'; label: string }> = [
  { key: 'BEFORE', label: 'Ishdan oldin' },
  { key: 'DURING', label: 'Ish jarayonida' },
  { key: 'AFTER', label: 'Ishdan keyin' },
];
const ACTOR: Record<string, string> = { CUSTOMER: 'Mijoz', MASTER: 'Usta', ADMIN: 'Administrator', SYSTEM: 'Tizim' };
const PAYMENT: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Kutilmoqda', tone: 'neutral' },
  PROCESSING: { label: 'Jarayonda', tone: 'warning' },
  SUCCEEDED: { label: 'To‘langan', tone: 'success' },
  FAILED: { label: 'Muvaffaqiyatsiz', tone: 'danger' },
  CANCELLED: { label: 'Bekor qilingan', tone: 'neutral' },
  REFUNDED: { label: 'Qaytarilgan', tone: 'warning' },
  PARTIALLY_REFUNDED: { label: 'Qisman qaytarilgan', tone: 'warning' },
};
const EXTRA: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Javob kutilmoqda', tone: 'warning' },
  APPROVED: { label: 'Mijoz kelishdi', tone: 'success' },
  REJECTED: { label: 'Mijoz rad etdi', tone: 'danger' },
  CANCELLED: { label: 'Bekor qilingan', tone: 'neutral' },
  EXPIRED: { label: 'Muddati tugagan', tone: 'neutral' },
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

function Party({ role, person, extra }: { role: string; person: AdminOrderPerson; extra?: string }) {
  return (
    <div className="gm-aordd__party">
      <small>{role}</small>
      <AccountLink accountNumber={person.accountNumber} className="gm-aordd__link">
        {accountName(person)}
      </AccountLink>
      <span>
        ID {person.accountNumber} · {person.phone}
      </span>
      {extra && <span>{extra}</span>}
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
      <Button size="sm" variant="secondary" loading={confirm.isPending} onClick={() => confirm.mutate(paymentId)}>
        Naqd pul olinganini tasdiqlash
      </Button>
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
    cancel: { title: 'Buyurtmani bekor qilish', text: 'Buyurtma bekor qilinadi va mijoz bilan usta xabardor qilinadi.', confirm: 'Bekor qilish', variant: 'danger' as const },
    COMPLETE: { title: 'Nizoni yakunlash (buyurtma bajarilgan)', text: 'Buyurtma «Yakunlandi» holatiga o‘tadi. Mijoz va usta xabardor qilinadi.', confirm: 'Yakunlash', variant: 'primary' as const },
    CANCEL: { title: 'Nizoni bekor qilish bilan hal qilish', text: 'Buyurtma bekor qilinadi. Mijoz va usta xabardor qilinadi.', confirm: 'Bekor qilish', variant: 'danger' as const },
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
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Ortga
          </Button>
          <Button variant={copy.variant} loading={pending} disabled={reason.trim().length < 3} onClick={submit}>
            {copy.confirm}
          </Button>
        </>
      }
    >
      <div className="gm-form">
        <Alert tone={copy.variant === 'danger' ? 'warning' : 'info'}>{copy.text}</Alert>
        {error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
        <Textarea label="Sabab / qaror izohi" required rows={3} maxLength={1000} hint="Audit jurnaliga va tomonlarga yoziladi (kamida 3 ta belgi)" value={reason} onChange={(event) => setReason(event.target.value)} />
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
        <ArrowLeft size={16} /> Buyurtmalar
      </Link>
      {query.isLoading && <PageLoader />}
      {query.isError && <Alert tone="danger">{getErrorMessage(query.error)}</Alert>}
      {order && (
        <>
          <header className="gm-aordd__hero">
            <div className="gm-aordd__heading">
              <div className="gm-aordd__title">
                <h1>{order.booking.request.title}</h1>
                <OrderStatus status={order.status} />
              </div>
              <p>
                Buyurtma <strong>№{order.orderNumber}</strong> (mijozning {order.customerOrderIndex}-, ustaning {order.masterOrderIndex}-buyurtmasi) · yaratilgan {formatDateTime(order.createdAt)}
                {order.booking.request.category && ` · ${order.booking.request.category.name}`}
              </p>
            </div>
            <div className="gm-aordd__actions">
              {order.conversationId && (
                <Link to={`/admin/suhbatlar?suhbat=${order.conversationId}`}>
                  <Button size="sm" variant="secondary">
                    <MessageSquare size={14} /> Suhbatni ko‘rish
                  </Button>
                </Link>
              )}
              {order.allowedActions.cancel && (
                <Button size="sm" variant="danger" onClick={() => setDialog('cancel')}>
                  <Ban size={14} /> Bekor qilish
                </Button>
              )}
              {order.allowedActions.resolve && (
                <>
                  <Button size="sm" onClick={() => setDialog('COMPLETE')}>
                    <CheckCircle2 size={14} /> Yakunlash
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setDialog('CANCEL')}>
                    <Ban size={14} /> Bekor qilish
                  </Button>
                </>
              )}
            </div>
          </header>

          {order.status === 'DISPUTED' && <Alert tone="warning">Buyurtma bo‘yicha nizo ochilgan. Ishning rasmlari va suhbatni ko‘rib chiqib, qaror qabul qiling.</Alert>}
          {order.cancellationReason && <Alert tone="info">Bekor qilish sababi: {order.cancellationReason}</Alert>}

          <section className="gm-aordd__money" aria-label="Summalar">
            <div>
              <small>Kelishilgan narx</small>
              <strong>{formatMoney(order.originalAmount, order.currency)}</strong>
            </div>
            <div>
              <small>Qo‘shimcha ish</small>
              <strong>{formatMoney(order.additionalAmount, order.currency)}</strong>
            </div>
            <div>
              <small>Yakuniy summa</small>
              <strong>{formatMoney(order.finalAmount, order.currency)}</strong>
            </div>
            <div>
              <small>Platforma ulushi</small>
              <strong>{order.platformFee ? formatMoney(order.platformFee, order.currency) : '—'}</strong>
            </div>
            <div>
              <small>Usta ulushi</small>
              <strong>{order.masterAmount ? formatMoney(order.masterAmount, order.currency) : '—'}</strong>
            </div>
          </section>

          <div className="gm-aordd__grid">
            <Card title="Tomonlar">
              <div className="gm-aordd__parties">
                <Party role="Mijoz" person={order.customer} />
                <Party role="Usta" person={order.master.user} extra={`${order.master.profession ?? 'Kasb ko‘rsatilmagan'} · reyting ${Number(order.master.ratingAvg).toFixed(1)} · ${order.master.completedOrders} ish`} />
              </div>
            </Card>

            <Card title="Jadval va manzil">
              <dl>
                <Row label="Boshlanish">{order.booking.scheduledStartAt ? formatDateTime(order.booking.scheduledStartAt) : '—'}</Row>
                <Row label="Tugash">{order.booking.scheduledEndAt ? formatDateTime(order.booking.scheduledEndAt) : '—'}</Row>
                <Row label="Manzil">
                  {order.booking.request.address ? (
                    <>
                      <MapPin size={13} aria-hidden="true" /> {[order.booking.request.address.city, order.booking.request.address.district, order.booking.request.address.addressLine].filter(Boolean).join(', ')}
                    </>
                  ) : (
                    '—'
                  )}
                </Row>
                <Row label="Ish boshlangan">{order.startedAt ? formatDateTime(order.startedAt) : '—'}</Row>
                <Row label="Ish topshirilgan">{order.completionSubmittedAt ? formatDateTime(order.completionSubmittedAt) : '—'}</Row>
                <Row label="Yakunlangan">{order.completedAt ? formatDateTime(order.completedAt) : '—'}</Row>
              </dl>
            </Card>
          </div>

          <Card title="Mijoz so‘rovi">
            <p className="gm-aordd__text">{order.booking.request.description}</p>
            <dl>
              <Row label="Usta taklifi">
                {formatMoney(order.booking.offer.price, order.currency)}
                {order.booking.offer.estimatedMinutes ? ` · taxminan ${order.booking.offer.estimatedMinutes} daqiqa` : ''}
              </Row>
              {order.booking.offer.message && <Row label="Usta izohi">{order.booking.offer.message}</Row>}
            </dl>
            {order.requestAssets.length > 0 && (
              <div className="gm-aordd__gallery" aria-label="Mijoz yuklagan rasmlar">
                {order.requestAssets.map((asset) => (
                  <figure key={asset.id}>
                    <MediaViewer assetId={asset.id} alt={fixFilename(asset.originalName)} label={fixFilename(asset.originalName)} size="lg" />
                    <FileInfo asset={asset} />
                  </figure>
                ))}
              </div>
            )}
          </Card>

          <Card title="Usta yuklagan ish rasmlari" aside={<Badge tone="primary">{order.workProofs.length} ta</Badge>}>
            {order.workProofs.length === 0 ? (
              <EmptyState title="Rasm yuklanmagan" />
            ) : (
              STAGES.map((stage) => {
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
                            <span className="gm-aordd__nofile">Fayl saqlanmagan</span>
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
              })
            )}
          </Card>

          <div className="gm-aordd__grid">
            <Card title="Holatlar tarixi">
              <ol className="gm-aordd__timeline">
                {order.statusHistory.map((step) => (
                  <li key={step.id}>
                    <strong>{STATUS_TEXT[step.newStatus]}</strong>
                    <span>
                      {step.oldStatus && (
                        <>
                          {STATUS_TEXT[step.oldStatus]} <ArrowRight size={11} aria-hidden="true" />{' '}
                        </>
                      )}
                      {ACTOR[step.actorType] ?? step.actorType}
                      {step.actor && ` · ${accountName(step.actor)}`}
                    </span>
                    {step.reason && step.reason !== 'Offer accepted' && <em>Sabab: {step.reason}</em>}
                    <time>{formatDateTime(step.createdAt)}</time>
                  </li>
                ))}
              </ol>
            </Card>

            <Card title="To‘lovlar" aside={<Badge tone="primary">{order.payments.length} ta</Badge>}>
              {order.payments.length === 0 ? (
                <EmptyState title="To‘lov usuli kiritilmagan" description={order.status === 'COMPLETED' ? 'Mijoz buyurtmani yakunlagan, lekin to‘lov usulini tanlamagan.' : 'Mijoz ishni tasdiqlaganda to‘lov usulini tanlaydi.'} />
              ) : (
                <ul className="gm-aordd__plain">
                  {order.payments.map((payment) => {
                    const info = PAYMENT[payment.status] ?? { label: payment.status, tone: 'neutral' as BadgeTone };
                    return (
                      <li key={payment.id}>
                        <div>
                          <strong>{formatMoney(payment.amount, payment.currency)}</strong> · {providerLabel(payment.provider)}
                          <Badge tone={info.tone}>{info.label}</Badge>
                        </div>
                        <small>
                          {formatDateTime(payment.succeededAt ?? payment.createdAt)}
                          {Number(payment.refundedAmount) > 0 && ` · qaytarilgan ${formatMoney(payment.refundedAmount, payment.currency)}`}
                          {payment.failureReason && ` · ${payment.failureReason}`}
                        </small>
                        {payment.provider === 'CASH' && payment.status === 'PENDING' && <CashConfirm paymentId={payment.id} />}
                        {payment.refunds.map((refund) => (
                          <small key={refund.id}>
                            Qaytarish: {formatMoney(refund.amount, payment.currency)} · {refund.status} · {refund.reason}
                          </small>
                        ))}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          {order.additionalWork.length > 0 && (
            <Card title="Qo‘shimcha ish so‘rovlari">
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
                <Card title="Mijoz sharhi">
                  <div className="gm-aordd__stars" aria-label={`${order.review.rating} baho`}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star key={index} size={18} fill={index < order.review!.rating ? 'currentColor' : 'none'} />
                    ))}
                  </div>
                  <p className="gm-aordd__text">{order.review.comment ?? 'Izoh qoldirilmagan.'}</p>
                  <small>
                    {accountName(order.review.author)} · {formatDateTime(order.review.createdAt)} · {order.review.status}
                  </small>
                </Card>
              )}
              {order.warranty && (
                <Card title="Kafolat">
                  <dl>
                    <Row label="Holati">{order.warranty.status}</Row>
                    <Row label="Boshlanishi">{formatDateTime(order.warranty.startsAt)}</Row>
                    <Row label="Tugashi">{formatDateTime(order.warranty.expiresAt)}</Row>
                  </dl>
                </Card>
              )}
              {order.cases.length > 0 && (
                <Card title="Shikoyat va nizolar">
                  <ul className="gm-aordd__plain">
                    {order.cases.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{item.title}</strong> <Badge tone="warning">{item.status}</Badge>
                        </div>
                        <small>
                          {item.type} · {formatDateTime(item.createdAt)}
                        </small>
                      </li>
                    ))}
                  </ul>
                  <Link to="/admin/shikoyatlar" className="gm-aordd__link">
                    Shikoyat va nizolar bo‘limi →
                  </Link>
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
