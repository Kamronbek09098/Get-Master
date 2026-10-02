import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, PackageCheck } from 'lucide-react';
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

export function RequestDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const request = useRequest(id ?? '');
  const submitRequest = useSubmitRequest(id ?? '');
  const cancelRequest = useCancelRequest(id ?? '');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (!id) return null;
  if (request.isLoading) return <PageLoader label="So‘rov yuklanmoqda…" />;
  if (request.isError) return <Alert tone="danger">{getErrorMessage(request.error)}</Alert>;
  if (!request.data) return null;

  const data = request.data;
  const canCancel = CANCELLABLE_STATUSES.includes(data.status);
  const canReceiveOffers = OFFER_ELIGIBLE_STATUSES.includes(data.status);

  return (
    <div className="gm-rqd">
      <Link to="/mijozlar/buyurtmalar" className="gm-pay__back gm-rqd__back">
        <ArrowLeft size={16} aria-hidden="true" /> Buyurtmalarga qaytish
      </Link>

      <header className="gm-rqd__hero">
        <div className="gm-rqd__hero-top">
          <h1>{data.title}</h1>
          <RequestStatus status={data.status} />
        </div>
        <p className="gm-rqd__desc">{data.description}</p>
        <dl className="gm-rqd__meta">
          <div>
            <dt>Yaratildi</dt>
            <dd>{formatDateTime(data.createdAt)}</dd>
          </div>
          {data.expiresAt && (
            <div>
              <dt>Amal qilish muddati</dt>
              <dd>{formatDateTime(data.expiresAt)}</dd>
            </div>
          )}
        </dl>
      </header>

      {data.status === 'DRAFT' && (
        <div className="gm-detail-section">
          <h2>So‘rov hali yuborilmagan</h2>
          {submitRequest.isError && <Alert tone="danger">{getErrorMessage(submitRequest.error)}</Alert>}
          <Button loading={submitRequest.isPending} onClick={() => submitRequest.mutate()}>
            So‘rovni yuborish
          </Button>
        </div>
      )}

      {!data.serviceId && data.status !== 'CANCELLED' && data.status !== 'EXPIRED' && data.status !== 'BOOKED' && (
        <div className="gm-detail-section">
          <h2>Xizmat turini tanlang</h2>
          <ServicePicker requestId={id} />
        </div>
      )}

      {canReceiveOffers && (
        <div className="gm-detail-section">
          <h2>Takliflar</h2>
          <OfferList requestId={id} />
          <aside className="gm-tips gm-rqd__how">
            <h3>Takliflar qanday keladi?</h3>
            <ul>
              <li>
                <span>Tizim xizmat turingizga mos, faol va tasdiqlangan ustalarni topadi.</span>
              </li>
              <li>
                <span>Reyting, masofa, ish jadvali va oldingi ishlari bo‘yicha ball beradi.</span>
              </li>
              <li>
                <span>Eng mos 5 ustaga xabar yuboradi; javob bo‘lmasa 5 daqiqadan keyin keyingi 5 taga (jami 3 marta).</span>
              </li>
              <li>
                <span>Ustalar narx va vaqt bilan taklif yuboradi — shu yerda ko‘rinadi, siz tanlaysiz.</span>
              </li>
            </ul>
          </aside>
        </div>
      )}

      {data.order && (
        <div className="gm-detail-section">
          <h2>Buyurtma yaratildi</h2>
          <div className="gm-card">
            <div className="gm-card__header">
              <h3>
                <PackageCheck size={18} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 6 }} />
                {accountName(data.order.master.user)}
              </h3>
              <OrderStatus status={data.order.status} />
            </div>
            <p className="gm-card__meta">
              {data.order.master.profession ?? 'Usta'} · ID {data.order.master.user.accountNumber} · {formatMoney(data.order.finalAmount, data.order.currency)}
            </p>
            <div style={{ marginTop: 'var(--gm-space-3)' }}>
              <Link to={`/mijozlar/buyurtmalar/${data.order.id}`}>
                <Button>Buyurtmani ochish</Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {data.status !== 'DRAFT' && data.status !== 'BOOKED' && data.status !== 'CANCELLED' && data.status !== 'EXPIRED' && (
        <div className="gm-detail-section">
          <h2>Mos ustalar</h2>
          <MatchingResults requestId={id} serviceSelected={!!data.serviceId} />
        </div>
      )}

      {canCancel && (
        <div className="gm-rqd__danger">
          <p>So‘rov kerak bo‘lmay qolgan bo‘lsa, uni bekor qilishingiz mumkin.</p>
          <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
            So‘rovni bekor qilish
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={cancelOpen}
        title="So‘rovni bekor qilish"
        description="Bekor qilish sababini kiriting."
        tone="danger"
        loading={cancelRequest.isPending}
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => cancelRequest.mutate(reason, { onSuccess: () => setCancelOpen(false) })}
      >
        <Textarea label="Sabab" required value={reason} onChange={(e) => setReason(e.target.value)} />
      </ConfirmDialog>
    </div>
  );
}
