import { useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
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
import './PortfolioManager.css';

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

  const items = portfolio.data ?? [];

  return (
    <div className="gm-pfm">
      <section className="gm-pfm__add">
        <span className="gm-pfm__icon" aria-hidden="true">
          <ImagePlus size={20} />
        </span>
        <h2>Yangi ish namunasi</h2>
        <p className="gm-pfm__lead">Bajargan ishingiz rasmini yuklang. Admin tasdiqlagach mijozlarga ko‘rinadi.</p>
        <div className="gm-pfm__fields">
          <MediaUploadField
            key={uploadKey}
            label="Ish namunasi (rasm)"
            accept="image/*"
            kind="MASTER_PORTFOLIO"
            linkType="MasterProfile"
            linkId={masterId}
            onReady={setMediaAssetId}
          />
          <Input label="Sarlavha" placeholder="Masalan: Oshxona kranini almashtirish" value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} />
        </div>
        {add.isError && <Alert tone="danger">{getErrorMessage(add.error)}</Alert>}
        <Button className="gm-pfm__submit" onClick={handleAdd} disabled={!mediaAssetId} loading={add.isPending}>
          <ImagePlus size={16} /> Portfolioga qo‘shish
        </Button>
        {!mediaAssetId && <p className="gm-pfm__hint">Avval rasm yuklang — shundan keyin qo‘shish mumkin bo‘ladi.</p>}
      </section>

      <section className="gm-pfm__list">
        <h2>Mening ishlarim{items.length > 0 ? ` (${items.length})` : ''}</h2>
        {portfolio.isLoading && <PageLoader label="Portfolio yuklanmoqda…" />}
        {portfolio.isError && <Alert tone="danger">{getErrorMessage(portfolio.error)}</Alert>}
        {portfolio.data && items.length === 0 && <EmptyState title="Portfolio bo‘sh" description="Birinchi ish namunangizni yuqoridan qo‘shing." />}
        <div className="gm-pfm__grid">
          {items.map((item) => (
            <article key={item.id} className="gm-pfm__item">
              <div className="gm-pfm__thumb">{item.mediaAssetId && <MediaThumbnail assetId={item.mediaAssetId} alt={item.title ?? 'Portfolio'} />}</div>
              <div className="gm-pfm__body">
                <h3>{item.title ?? 'Nomsiz'}</h3>
                <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                {item.status === 'REJECTED' && item.rejectReason && <p className="gm-pfm__reason">Sabab: {item.rejectReason}</p>}
              </div>
              <Button size="sm" variant="secondary" className="gm-btn-tone gm-btn-tone--danger gm-pfm__remove" loading={remove.isPending} onClick={() => remove.mutate(item.id)}>
                <Trash2 size={14} /> O‘chirish
              </Button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
