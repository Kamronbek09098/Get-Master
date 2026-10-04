import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { CompareSlider } from '@/features/media/components/CompareSlider';
import { MediaThumbnail } from '@/features/media/components/MediaThumbnail';
import { MediaViewer } from '@/features/media/components/MediaViewer';
import { t } from '@/i18n';
import type { PublicPortfolioItem } from '../types';
import './PublicPortfolio.css';

/** Ustaning tasdiqlangan ishlari. Oldin/keyin juftligi bo‘lsa — kartochkada belgi va ochilganda taqqoslash. */
export function PublicPortfolio({ items }: { items: PublicPortfolioItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items.find((item) => item.id === openId) ?? null;
  const shown = items.filter((item) => item.mediaAssetId);
  if (shown.length === 0) return null;

  return (
    <>
      <ul className="gm-pub-pf">
        {shown.map((item) => (
          <li key={item.id}>
            <button type="button" className="gm-pub-pf__tile" onClick={() => setOpenId(item.id)} aria-label={item.title ?? t('Portfolio ishi')}>
              <MediaThumbnail assetId={item.mediaAssetId as string} alt={item.title ?? t('Portfolio ishi')} />
              {item.beforeMediaAssetId && <span className="gm-pub-pf__badge">{t('Oldin / Keyin')}</span>}
              {item.title && <span className="gm-pub-pf__title">{item.title}</span>}
            </button>
          </li>
        ))}
      </ul>
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.title ?? t('Portfolio ishi')} large>
        {open?.mediaAssetId &&
          (open.beforeMediaAssetId ? (
            <CompareSlider beforeId={open.beforeMediaAssetId} afterId={open.mediaAssetId} alt={open.title ?? t('Portfolio ishi')} />
          ) : (
            <MediaViewer assetId={open.mediaAssetId} alt={open.title ?? t('Portfolio ishi')} label={open.title ?? t('Portfolio ishi')} size="lg" />
          ))}
        {open?.description && <p className="gm-pub-pf__desc">{open.description}</p>}
      </Modal>
    </>
  );
}
