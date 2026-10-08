import { useState } from 'react';
import { Download, FileText, Maximize2 } from 'lucide-react';
import { mediaService } from '@/features/media/services/media.service';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { MediaViewer } from '@/features/media/components/MediaViewer';
import { useMediaSignedUrl } from '@/features/media/hooks/useMedia';
import { RoundVideoPlayer } from '@/features/communication/components/RoundVideoPlayer';
import { VoicePlayer } from '@/features/communication/components/VoicePlayer';
import type { ChatAttachment } from '@/features/communication/types';
import { t } from '@/i18n';
import '@/features/communication/chat.css';
import './AdminAttachment.css';

const seconds = (name: string) => Number(/-d(\d+)\.[a-z0-9]+$/i.exec(name)?.[1] ?? 0);
const isRound = (item: ChatAttachment) => /^round-/i.test(item.name) && item.mimeType.startsWith('video/');
const isVoice = (item: ChatAttachment) => /^voice-/i.test(item.name) || item.mimeType.startsWith('audio/');

/** Katta oyna: dumaloq video yoki oddiy video to‘liq o‘lchamda, boshqaruv tugmalari bilan. */
function BigVideo({ assetId, name, round, open, onClose }: { assetId: string; name: string; round: boolean; open: boolean; onClose: () => void }) {
  const url = useMediaSignedUrl(assetId, 'original', open);
  return (
    <Modal open={open} onClose={onClose} title={name} wide footer={url.data ? <a className="gm-button gm-button--secondary" href={url.data.url} download><Download size={16} /> {t('Yuklab olish')}</a> : undefined}>
      <div className="gm-adatt__stage">
        {url.isLoading && <Spinner />}
        {url.isError && <p>{t('Faylni yuklab bo‘lmadi.')}</p>}
        {url.data && <video className={round ? 'gm-adatt__video gm-adatt__video--round' : 'gm-adatt__video'} src={url.data.url} controls autoPlay playsInline />}
      </div>
    </Modal>
  );
}

/** Admin suhbat ko‘rinishidagi biriktirma: dumaloq video, ovozli xabar, video, rasm va fayl — hammasi ijro etiladi/ochiladi. */
export function AdminAttachment({ file }: { file: ChatAttachment }) {
  const [big, setBig] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isRound(file)) {
    return (
      <div className="gm-adatt gm-adatt--round">
        <RoundVideoPlayer assetId={file.mediaAssetId} seconds={seconds(file.name)} />
        <button type="button" className="gm-adatt__open" onClick={() => setBig(true)}>
          <Maximize2 size={14} aria-hidden="true" /> {t('Katta ochish')}
        </button>
        <BigVideo assetId={file.mediaAssetId} name={t('Dumaloq video')} round open={big} onClose={() => setBig(false)} />
      </div>
    );
  }
  if (isVoice(file)) {
    return (
      <div className="gm-adatt gm-adatt--voice">
        <VoicePlayer assetId={file.mediaAssetId} seconds={seconds(file.name)} />
      </div>
    );
  }
  if (file.mimeType.startsWith('video/')) {
    return (
      <div className="gm-adatt">
        <MediaViewer assetId={file.mediaAssetId} alt={file.name} label={file.name} size="lg" />
        <button type="button" className="gm-adatt__open" onClick={() => setBig(true)}>
          <Maximize2 size={14} aria-hidden="true" /> {t('Katta ochish')}
        </button>
        <BigVideo assetId={file.mediaAssetId} name={file.name} round={false} open={big} onClose={() => setBig(false)} />
      </div>
    );
  }
  if (file.mimeType.startsWith('image/')) return <MediaViewer assetId={file.mediaAssetId} alt={file.name} label={file.name} size="lg" />;
  return (
    <button
      type="button"
      className="gm-adatt__file"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void mediaService
          .getSignedUrl(file.mediaAssetId, 'original')
          .then(({ url }) => window.open(url, '_blank', 'noopener'))
          .finally(() => setBusy(false));
      }}
    >
      <FileText size={18} aria-hidden="true" /> <span>{file.name}</span>
    </button>
  );
}
