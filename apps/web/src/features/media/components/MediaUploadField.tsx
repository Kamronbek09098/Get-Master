import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import type { LinkTargetType, MediaAssetKind } from '@/types/common';
import { useMediaStatus, useUploadMedia } from '../hooks/useMedia';
import { MediaThumbnail } from './MediaThumbnail';
import './MediaUploadField.css';

const STATUS_LABEL: Record<string, string> = {
  UPLOADING: 'Yuklanmoqda',
  QUARANTINED: 'Navbatda',
  SCANNING: 'Tekshirilmoqda',
  PROCESSING: 'Qayta ishlanmoqda',
  READY: 'Tayyor',
  REJECTED: 'Rad etildi',
  FAILED: 'Xatolik',
};
const STATUS_TONE: Record<string, 'neutral' | 'success' | 'danger' | 'warning'> = {
  UPLOADING: 'neutral',
  QUARANTINED: 'neutral',
  SCANNING: 'warning',
  PROCESSING: 'warning',
  READY: 'success',
  REJECTED: 'danger',
  FAILED: 'danger',
};

export interface MediaUploadFieldProps {
  label: string;
  accept?: string;
  kind: MediaAssetKind;
  linkType: LinkTargetType;
  linkId: string;
  onReady?: (mediaAssetId: string) => void;
}

export function MediaUploadField({ label, accept = 'image/*,video/*', kind, linkType, linkId, onReady }: MediaUploadFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [notifiedReady, setNotifiedReady] = useState(false);

  const upload = useUploadMedia();
  const status = useMediaStatus(assetId);

  const currentStatus = status.data?.status;
  useEffect(() => {
    if (currentStatus === 'READY' && !notifiedReady && assetId) {
      setNotifiedReady(true);
      onReady?.(assetId);
    }
  }, [currentStatus, notifiedReady, assetId, onReady]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setNotifiedReady(false);
    upload.mutate(
      { file, kind, linkType, linkId },
      { onSuccess: (asset) => setAssetId(asset.id) },
    );
    event.target.value = '';
  }

  return (
    <div className="gm-media-upload">
      <label htmlFor={inputId} className="gm-field__label">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        onChange={(e) => void handleFileChange(e)}
        className="gm-visually-hidden"
      />
      <Button type="button" variant="secondary" size="sm" loading={upload.isPending} onClick={() => inputRef.current?.click()}>
        Fayl tanlash
      </Button>

      {upload.isError && <Alert tone="danger">{getErrorMessage(upload.error)}</Alert>}

      {assetId && currentStatus && (
        <div className="gm-media-upload__result">
          {currentStatus === 'READY' ? (
            <MediaThumbnail assetId={assetId} alt={label} />
          ) : (
            <Badge tone={STATUS_TONE[currentStatus]}>{STATUS_LABEL[currentStatus]}</Badge>
          )}
          {(currentStatus === 'REJECTED' || currentStatus === 'FAILED') && status.data?.rejectionReason && (
            <p className="gm-media-upload__reason">{status.data.rejectionReason}</p>
          )}
        </div>
      )}
    </div>
  );
}
