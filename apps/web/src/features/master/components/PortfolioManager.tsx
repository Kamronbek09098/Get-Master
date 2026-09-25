import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/error-messages';
import { MediaUploadField } from '@/features/media/components/MediaUploadField';
import { MediaThumbnail } from '@/features/media/components/MediaThumbnail';
import { useAddPortfolio, usePortfolio, useRemovePortfolio } from '../hooks/useMasterManage';

const STATUS_LABEL = { PENDING: 'Tasdiqlanishi kutilmoqda', APPROVED: 'Tasdiqlangan', REJECTED: 'Rad etilgan' } as const;
const STATUS_TONE = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' } as const;

export function PortfolioManager({ masterId }: { masterId: string }) {
  const portfolio = usePortfolio();
  const add = useAddPortfolio();
  const remove = useRemovePortfolio();
  const [title, setTitle] = useState('');
  const [mediaAssetId, setMediaAssetId] = useState<string | null>(null);
  const [uploadKey, setUploadKey] = useState(0);

  function handleAdd() {
    if (!mediaAssetId) return;
    add.mutate(
      { mediaAssetId, title: title.trim() || undefined },
      {
        onSuccess: () => {
          setMediaAssetId(null);
          setTitle('');
          setUploadKey((key) => key + 1);
        },
      },
    );
  }

  return (
    <div className="gm-form">
      <MediaUploadField
        key={uploadKey}
        label="Ish namunasi (rasm)"
        accept="image/*"
        kind="MASTER_PORTFOLIO"
        linkType="MasterProfile"
        linkId={masterId}
        onReady={setMediaAssetId}
      />
      <Input label="Sarlavha" value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} />
      <Alert tone="info" title="Adminga tekshiruv uchun yuboriladi">
        Qo‘shilgan ish namunasi admin tasdiqlamaguncha profilingizda va mijozlarga ko‘rinmaydi.
      </Alert>
      {add.isError && <Alert tone="danger">{getErrorMessage(add.error)}</Alert>}
      <div>
        <Button onClick={handleAdd} disabled={!mediaAssetId} loading={add.isPending}>
          Portfolioga qo‘shish
        </Button>
      </div>

      {portfolio.isLoading && <PageLoader label="Portfolio yuklanmoqda…" />}
      {portfolio.isError && <Alert tone="danger">{getErrorMessage(portfolio.error)}</Alert>}
      {portfolio.data && portfolio.data.length === 0 && <EmptyState title="Portfolio bo‘sh" />}
      <div className="gm-portfolio-grid">
        {(portfolio.data ?? []).map((item) => (
          <div key={item.id} className="gm-card">
            {item.mediaAssetId && <MediaThumbnail assetId={item.mediaAssetId} alt={item.title ?? 'Portfolio'} />}
            <h3>{item.title ?? 'Nomsiz'}</h3>
            <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
            {item.status === 'REJECTED' && item.rejectReason && <p className="gm-card__meta">Sabab: {item.rejectReason}</p>}
            <Button size="sm" variant="ghost" loading={remove.isPending} onClick={() => remove.mutate(item.id)}>
              O‘chirish
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
