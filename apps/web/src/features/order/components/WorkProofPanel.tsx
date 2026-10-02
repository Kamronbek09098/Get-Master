import { useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { MediaUploadField } from '@/features/media/components/MediaUploadField';
import { MediaThumbnail } from '@/features/media/components/MediaThumbnail';
import { useAddWorkProof, useRemoveWorkProof, useWorkProofs } from '../hooks/useOrders';
import type { WorkStage } from '@/types/common';
import './WorkProofPanel.css';
import { t } from '@/i18n';

const STAGE_TITLE: Record<WorkStage, string> = {
  BEFORE: t('Ishdan oldingi holat'),
  DURING: t('Ish jarayoni'),
  AFTER: t('Ishdan keyingi natija'),
};

interface WorkProofPanelProps {
  orderId: string;
  stage: WorkStage;
  canEdit?: boolean;
  required?: boolean;
  hint?: string;
}

export function WorkProofPanel({ orderId, stage, canEdit = false, required = false, hint }: WorkProofPanelProps) {
  const [uploadKey, setUploadKey] = useState(0);
  const proofs = useWorkProofs(orderId);
  const addWorkProof = useAddWorkProof(orderId);
  const removeWorkProof = useRemoveWorkProof(orderId);
  const items = (proofs.data ?? []).filter((proof) => proof.stage === stage);
  if (!canEdit && items.length === 0) return null;

  return (
    <div className="gm-work-proof-panel">
      <div className="gm-work-proof-panel__head">
        <p className="gm-work-proof-panel__label">
          <Camera size={16} aria-hidden="true" /> {STAGE_TITLE[stage]}
          {required && <span className="gm-work-proof-panel__req">majburiy</span>}
        </p>
        <span className="gm-work-proof-panel__count">{items.length} ta</span>
      </div>
      {hint && <p className="gm-work-proof-panel__hint">{hint}</p>}

      {items.length > 0 && (
        <ul className="gm-work-proof-panel__grid">
          {items.map((proof) => (
            <li key={proof.id}>
              {proof.mediaAssetId && <MediaThumbnail assetId={proof.mediaAssetId} alt={STAGE_TITLE[stage]} />}
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t('Rasmni o‘chirish')}
                  loading={removeWorkProof.isPending && removeWorkProof.variables === proof.id}
                  onClick={() => removeWorkProof.mutate(proof.id)}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <MediaUploadField
          key={uploadKey}
          label={t('Foto yoki video qo‘shish')}
          kind="WORK_PROOF"
          linkType="Order"
          linkId={orderId}
          onReady={(mediaAssetId) => addWorkProof.mutate({ stage, mediaAssetId }, { onSuccess: () => setUploadKey((key) => key + 1) })}
        />
      )}
      {addWorkProof.isError && <Alert tone="danger">{getErrorMessage(addWorkProof.error)}</Alert>}
      {removeWorkProof.isError && <Alert tone="danger">{getErrorMessage(removeWorkProof.error)}</Alert>}
    </div>
  );
}
