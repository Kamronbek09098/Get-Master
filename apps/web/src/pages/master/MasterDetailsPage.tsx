import { accountName } from '@/lib/account-name';
import { useNavigate, useParams } from 'react-router-dom';
import { Award, CalendarClock, MessageCircle, Star } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { initials } from '@/lib/utils';
import { useMaster } from '@/features/master/hooks/useMaster';
import { useOpenMasterChat } from '@/features/communication/hooks/useCommunication';
import { TrustBadge } from '@/features/trust/components/TrustBadge';
import { ReviewList } from '@/features/review/components/ReviewList';

export function MasterDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const master = useMaster(id);
  const openChat = useOpenMasterChat();

  if (master.isLoading) return <PageLoader label="Usta yuklanmoqda…" />;
  if (master.isError) return <Alert tone="danger">{getErrorMessage(master.error)}</Alert>;
  if (!master.data) return null;

  const data = master.data;
  const name = accountName(data.user);

  return (
    <div>
      <section className="gm-profile-hero">
        <div className="gm-profile-hero__top">
          <span className="gm-avatar gm-avatar--lg" aria-hidden="true">
            {initials(name)}
          </span>
          <div className="gm-profile-hero__who">
            <h1>{name}</h1>
            <p>{data.profession ?? 'Kasb ko‘rsatilmagan'}</p>
            <div className="gm-profile-hero__badges">
              <TrustBadge verification={data.verification} />
            </div>
          </div>
        </div>

        <dl className="gm-profile-hero__stats">
          <div>
            <dt>
              <Star size={15} /> Reyting
            </dt>
            <dd>
              {Number(data.ratingAvg).toFixed(1)} <small>({data.ratingCount} ta sharh)</small>
            </dd>
          </div>
          <div>
            <dt>
              <Award size={15} /> Bajarilgan ishlar
            </dt>
            <dd>{data.completedOrders}</dd>
          </div>
          <div>
            <dt>
              <CalendarClock size={15} /> Tajriba
            </dt>
            <dd>{data.experienceYears ? `${data.experienceYears} yil` : '—'}</dd>
          </div>
        </dl>

        {data.bio && <p className="gm-profile-hero__bio">{data.bio}</p>}

        <div className="gm-action-row">
          <Button
            size="lg"
            loading={openChat.isPending}
            onClick={() => openChat.mutate(data.id, { onSuccess: (conversation) => navigate(`/mijozlar/chat?suhbat=${conversation.id}`) })}
          >
            <MessageCircle size={20} /> Chat orqali bog‘lanish
          </Button>
        </div>
        {openChat.isError && <Alert tone="danger">{getErrorMessage(openChat.error)}</Alert>}
      </section>

      <section className="gm-detail-section">
        <h2>Sharhlar</h2>
        <ReviewList masterId={data.id} />
      </section>
    </div>
  );
}
