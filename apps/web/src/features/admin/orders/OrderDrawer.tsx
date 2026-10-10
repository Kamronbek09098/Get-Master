import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, ExternalLink, Gavel, MapPin, MessageSquare, Phone, Star, X } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { useAdminOrder } from '@/features/admin/hooks/useAdmin';
import { OrderActionDialog } from '@/features/admin/orders/OrderActionDialog';
import type { OrderActionMode } from '@/features/admin/orders/OrderActionDialog';
import type { AdminOrderDetail, AdminOrderPerson, AdminOrderRow } from '@/features/admin/types';
import { CASE_STATUS_LABEL, CASE_TYPE_LABEL, caseTone } from '@/features/dispute/types';
import type { CaseStatus } from '@/features/dispute/types';
import { MediaViewer } from '@/features/media/components/MediaViewer';
import { fixFilename } from '@/features/media/file-info';
import { OrderStatus } from '@/features/order/components/OrderStatus';
import { ProviderLogo } from '@/features/payment/components/ProviderLogo';
import { PAYMENT_STATUS_LABEL, providerLabel } from '@/features/payment/labels';
import type { PaymentProvider, PaymentStatus } from '@/types/common';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { cx, formatDateTime, formatMoney, formatRelativeTime } from '@/lib/utils';
import '@/features/admin/users/UserDrawer.css';
import './OrderDrawer.css';
import { t } from '@/i18n';

type Tab = 'info' | 'payment' | 'history' | 'cases';
const STAGE: Record<string, string> = { BEFORE: t('Ishdan oldin'), DURING: t('Ish paytida'), AFTER: t('Ishdan keyin') };
const PAYMENT_TONE: Record<string, BadgeTone> = { SUCCEEDED: 'success', PENDING: 'warning', PROCESSING: 'warning', FAILED: 'danger', CANCELLED: 'neutral', REFUNDED: 'neutral', PARTIALLY_REFUNDED: 'warning' };

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="gm-udr__row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function Party({ title, person, extra, rating, onOpen }: { title: string; person: AdminOrderPerson; extra?: string | null; rating?: string; onOpen: () => void }) {
  const name = accountName(person);
  return (
    <div className="gm-odr__party">
      <small>{title}</small>
      <div>
        <ChatAvatar name={name} seed={person.id} size="md" src={person.avatar} />
        <span>
          <strong>{name}</strong>
          {rating && Number(rating) > 0 && <em><Star size={12} fill="currentColor" aria-hidden="true" /> {Number(rating).toFixed(1)}</em>}
          {extra && <em>{extra}</em>}
          <em><Phone size={11} aria-hidden="true" /> {person.phone}</em>
        </span>
      </div>
      <Button size="sm" variant="secondary" onClick={onOpen}>{t('Profilni ko‘rish')}</Button>
    </div>
  );
}

/** Buyurtma qatorini bosganda ochiladigan o‘ng panel: umumiy ma’lumot, tomonlar, narx va to‘lov, tarix va nizolar. */
export function OrderDrawer({ order, onClose }: { order: AdminOrderRow; onClose: () => void }) {
  const navigate = useNavigate();
  const detail = useAdminOrder(order.id);
  const [tab, setTab] = useState<Tab>('info');
  const [action, setAction] = useState<OrderActionMode | null>(null);
  useEffect(() => setTab('info'), [order.id]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !action) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, action]);

  const d: AdminOrderDetail | undefined = detail.data;
  const status = d?.status ?? order.status;
  const payment = d ? (d.payments.find((row) => row.status === 'SUCCEEDED') ?? d.payments[0] ?? null) : order.payment;
  const casesCount = d?.cases.length ?? order._count.cases;
  const request = d?.booking.request;
  const address = request?.address ? [request.address.city, request.address.district, request.address.addressLine].filter(Boolean).join(', ') : order.city;

  return (
    <>
      <div className="gm-udr__backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="gm-udr" role="dialog" aria-modal="true" aria-label={t('Buyurtma №{n}', { n: order.orderNumber })}>
        <header className="gm-odr__head">
          <div>
            <small>{t('Buyurtma tafsilotlari')}</small>
            <h2>№{order.orderNumber}</h2>
            <OrderStatus status={status} />
          </div>
          <button type="button" className="gm-udr__close" onClick={onClose} aria-label={t('Yopish')}>
            <X size={18} />
          </button>
        </header>

        <div className="gm-udr__tabs" role="tablist">
          {([['info', t('Umumiy')], ['payment', t('Xizmat va to‘lov')], ['history', t('Tarix')], ['cases', casesCount > 0 ? t('Nizo ({count})', { count: casesCount }) : t('Nizo')]] as Array<[Tab, string]>).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} className={cx(tab === value && 'is-on')} onClick={() => setTab(value)}>{label}</button>
          ))}
        </div>

        <div className="gm-udr__body">
          {detail.isError && <Alert tone="danger">{getErrorMessage(detail.error)}</Alert>}

          {tab === 'info' && (
            <>
              <section className="gm-udr__card">
                <h3>{t('Buyurtma ma’lumotlari')}</h3>
                <Info label={t('Buyurtma raqami')}>№{order.orderNumber}</Info>
                <Info label={t('Yaratilgan sana')}>{formatDateTime(order.createdAt)} <small>({formatRelativeTime(order.createdAt)})</small></Info>
                <Info label={t('Xizmat turi')}>{d?.booking.request.category?.name ?? order.category?.name ?? '—'}</Info>
                <Info label={t('So‘rov')}>{order.title}</Info>
                <Info label={t('Holat')}><OrderStatus status={status} /></Info>
                <Info label={t('To‘lov holati')}>{payment ? <Badge tone={PAYMENT_TONE[payment.status] ?? 'neutral'}>{PAYMENT_STATUS_LABEL[payment.status as PaymentStatus] ?? payment.status}</Badge> : <Badge tone="neutral">{t('To‘lov yo‘q')}</Badge>}</Info>
                <Info label={t('Summa')}>{formatMoney(d?.finalAmount ?? order.finalAmount, order.currency)}</Info>
                {(d?.booking.scheduledStartAt ?? order.scheduledStartAt) && <Info label={t('Rejalashtirilgan vaqt')}>{formatDateTime(d?.booking.scheduledStartAt ?? order.scheduledStartAt)}</Info>}
                {d?.completedAt && <Info label={t('Yakunlangan')}>{formatDateTime(d.completedAt)}</Info>}
                {d?.cancelledAt && <Info label={t('Bekor qilingan')}>{formatDateTime(d.cancelledAt)}</Info>}
                {d?.cancellationReason && <Info label={t('Bekor qilish sababi')}>{d.cancellationReason}</Info>}
                {address && <Info label={t('Manzil')}><span className="gm-odr__addr"><MapPin size={13} aria-hidden="true" /> {address}</span></Info>}
              </section>

              <section className="gm-udr__card">
                <h3>{t('Tomonlar')}</h3>
                <div className="gm-odr__parties">
                  <Party title={t('Mijoz')} person={order.customer} onOpen={() => navigate(`/admin/foydalanuvchilar/${order.customer.accountNumber}`)} />
                  <Party title={t('Usta')} person={order.master.user} extra={order.master.profession} rating={d?.master.ratingAvg ?? order.master.ratingAvg} onOpen={() => navigate(`/admin/foydalanuvchilar/${order.master.user.accountNumber}`)} />
                </div>
              </section>

              {d && d.workProofs.length > 0 && (
                <section className="gm-udr__card">
                  <h3>{t('Bajarilgan ish')} <small>{t('{count} ta rasm', { count: d.workProofs.length })}</small></h3>
                  <div className="gm-odr__proofs">
                    {d.workProofs.slice(0, 8).map((proof) =>
                      proof.mediaAssetId ? (
                        <div key={proof.id}>
                          <MediaViewer assetId={proof.mediaAssetId} alt={STAGE[proof.stage] ?? proof.stage} label={`${STAGE[proof.stage] ?? proof.stage}: ${proof.asset ? fixFilename(proof.asset.originalName) : ''}`} size="md" />
                          <small>{STAGE[proof.stage] ?? proof.stage}</small>
                        </div>
                      ) : null,
                    )}
                  </div>
                  {d.workProofs.length > 8 && <p className="gm-udr__muted">{t('Barchasini buyurtma sahifasida ko‘ring.')}</p>}
                </section>
              )}

              {d?.review && (
                <section className="gm-udr__card">
                  <h3>{t('Sharh')}</h3>
                  <Info label={t('Baho')}>★ {d.review.rating}</Info>
                  {d.review.comment && <p className="gm-udr__muted">“{d.review.comment}”</p>}
                </section>
              )}

              <section className="gm-udr__card">
                <h3>{t('Amallar')}</h3>
                <div className="gm-udr__actions">
                  <Button variant="secondary" onClick={() => navigate(`/admin/buyurtmalar/${order.id}`)}><ExternalLink size={16} aria-hidden="true" /> {t('Buyurtmani ochish')}</Button>
                  <Button variant="secondary" onClick={() => setTab('cases')} disabled={casesCount === 0}><Gavel size={16} aria-hidden="true" /> {t('Nizoni ko‘rish')}</Button>
                  {d?.conversationId && <Button variant="secondary" onClick={() => navigate(`/admin/suhbatlar?suhbat=${d.conversationId}`)}><MessageSquare size={16} aria-hidden="true" /> {t('Suhbatni ochish')}</Button>}
                  {d?.allowedActions.cancel && <Button variant="secondary" className="gm-udr__danger" onClick={() => setAction('cancel')}><Ban size={16} aria-hidden="true" /> {t('Bekor qilish')}</Button>}
                  {d?.allowedActions.resolve && <Button onClick={() => setAction('COMPLETE')}>{t('Yakunlash (nizo)')}</Button>}
                  {d?.allowedActions.resolve && <Button variant="secondary" className="gm-udr__danger" onClick={() => setAction('CANCEL')}>{t('Bekor qilish (nizo)')}</Button>}
                </div>
              </section>
            </>
          )}

          {tab === 'payment' && (
            <>
              <section className="gm-udr__card">
                <h3>{t('Xizmat va to‘lov')}</h3>
                {d ? (
                  <>
                    <Info label={t('Xizmat narxi')}>{formatMoney(d.originalAmount, d.currency)}</Info>
                    <Info label={t('Qo‘shimcha ishlar')}>{formatMoney(d.additionalAmount, d.currency)}</Info>
                    <Info label={t('Platforma komissiyasi')}>{d.platformFee != null ? formatMoney(d.platformFee, d.currency) : t('Hali hisoblanmagan')}</Info>
                    <Info label={t('Usta oladigan summa')}>{d.masterAmount != null ? formatMoney(d.masterAmount, d.currency) : t('Hali hisoblanmagan')}</Info>
                    <div className="gm-odr__total"><span>{t('Jami summa')}</span><strong>{formatMoney(d.finalAmount, d.currency)}</strong></div>
                  </>
                ) : (
                  <p className="gm-udr__muted">{t('Yuklanmoqda…')}</p>
                )}
              </section>

              {d && d.additionalWork.length > 0 && (
                <section className="gm-udr__card">
                  <h3>{t('Qo‘shimcha ish so‘rovlari')}</h3>
                  {d.additionalWork.map((work) => (
                    <div key={work.id} className="gm-udr__sub">
                      <span>
                        <strong>{work.reason}</strong>
                        <small>{work.description}</small>
                        <small>{formatDateTime(work.requestedAt)}</small>
                      </span>
                      <span className="gm-odr__side"><b>{formatMoney(work.amount, work.currency)}</b><Badge tone={work.status === 'APPROVED' ? 'success' : work.status === 'REJECTED' ? 'danger' : 'warning'}>{work.status === 'APPROVED' ? t('Tasdiqlangan') : work.status === 'REJECTED' ? t('Rad etilgan') : t('Kutilmoqda')}</Badge></span>
                    </div>
                  ))}
                </section>
              )}

              <section className="gm-udr__card">
                <h3>{t('To‘lovlar')}</h3>
                {d && d.payments.length === 0 && <p className="gm-udr__muted">{t('Hali to‘lov urinishi bo‘lmagan.')}</p>}
                {d?.payments.map((row) => (
                  <div key={row.id} className="gm-odr__pay">
                    <ProviderLogo provider={row.provider as PaymentProvider} size={36} />
                    <span>
                      <strong>{providerLabel(row.provider)}</strong>
                      <small>{formatDateTime(row.succeededAt ?? row.createdAt)}{row.failureReason ? ` · ${row.failureReason}` : ''}</small>
                      {row.refunds.map((refund) => <small key={refund.id}>{t('Qaytarildi')}: {formatMoney(refund.amount, row.currency)} · {refund.reason}</small>)}
                    </span>
                    <span className="gm-odr__side"><b>{formatMoney(row.amount, row.currency)}</b><Badge tone={PAYMENT_TONE[row.status] ?? 'neutral'}>{PAYMENT_STATUS_LABEL[row.status as PaymentStatus] ?? row.status}</Badge></span>
                  </div>
                ))}
                {d?.warranty && <Info label={t('Kafolat')}>{formatDateTime(d.warranty.startsAt)} — {formatDateTime(d.warranty.expiresAt)}</Info>}
              </section>
            </>
          )}

          {tab === 'history' && (
            <section className="gm-udr__card">
              <h3>{t('Holatlar tarixi')}</h3>
              {detail.isLoading && <p className="gm-udr__muted">{t('Yuklanmoqda…')}</p>}
              {d?.statusHistory.map((entry) => (
                <div key={entry.id} className="gm-udr__sub">
                  <span>
                    <strong>{entry.oldStatus ? <><OrderStatus status={entry.oldStatus} /> → </> : null}<OrderStatus status={entry.newStatus} /></strong>
                    {entry.reason && <small>{entry.reason}</small>}
                    <small>{formatDateTime(entry.createdAt)} · {entry.actor ? accountName(entry.actor) : entry.actorType === 'SYSTEM' ? t('Tizim') : entry.actorType}</small>
                  </span>
                </div>
              ))}
            </section>
          )}

          {tab === 'cases' && (
            <section className="gm-udr__card">
              <h3>{t('Nizo va shikoyatlar')}</h3>
              {d && d.cases.length === 0 && <p className="gm-udr__muted">{t('Bu buyurtma bo‘yicha nizo yoki shikoyat yo‘q.')}</p>}
              {d?.cases.map((item) => (
                <div key={item.id} className="gm-udr__sub">
                  <span>
                    <strong>{item.title}</strong>
                    <small>{CASE_TYPE_LABEL[item.type] ?? item.type} · {formatDateTime(item.createdAt)}</small>
                  </span>
                  <Badge tone={caseTone(item.status) === 'ok' ? 'success' : caseTone(item.status) === 'no' ? 'neutral' : 'warning'}>{CASE_STATUS_LABEL[item.status as CaseStatus] ?? item.status}</Badge>
                </div>
              ))}
              {d && d.cases.length > 0 && <Button fullWidth variant="secondary" onClick={() => navigate('/admin/shikoyatlar')}>{t('Shikoyat va nizolar bo‘limiga o‘tish')}</Button>}
            </section>
          )}
        </div>
      </aside>
      {action && <OrderActionDialog order={order} mode={action} onClose={() => setAction(null)} />}
    </>
  );
}
