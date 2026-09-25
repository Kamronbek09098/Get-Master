import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDate } from '@/lib/utils';
import { MediaUploadField } from '@/features/media/components/MediaUploadField';
import { useRemoveVerification, useSubmitVerification, useTrustStatus } from '../hooks/useTrust';
import type { VerificationDocument, VerificationDocumentType } from '../types';
import { TrustBadge } from './TrustBadge';

const DOCUMENT_OPTIONS = [
  { value: 'IDENTITY', label: 'Shaxsni tasdiqlovchi hujjat' },
  { value: 'CERTIFICATE', label: 'Sertifikat' },
  { value: 'LICENSE', label: 'Litsenziya' },
  { value: 'OTHER', label: 'Boshqa' },
];

const SINGLE_TYPES: VerificationDocumentType[] = ['IDENTITY', 'LICENSE'];

export function TrustProfile({ masterId }: { masterId: string }) {
  const trust = useTrustStatus();
  const submit = useSubmitVerification();
  const remove = useRemoveVerification();
  const [documentType, setDocumentType] = useState<VerificationDocumentType>('CERTIFICATE');
  const [mediaAssetId, setMediaAssetId] = useState<string | null>(null);
  const [uploadKey, setUploadKey] = useState(0);
  const [toDelete, setToDelete] = useState<VerificationDocument | null>(null);

  if (trust.isLoading) return <PageLoader label="Tasdiqlash holati yuklanmoqda…" />;
  if (trust.isError) return <Alert tone="danger">{getErrorMessage(trust.error)}</Alert>;
  if (!trust.data) return null;

  const documents = trust.data.documents;
  const uploaded = new Set(documents.map((document) => document.documentType));
  const lockedTypes = SINGLE_TYPES.filter((type) => uploaded.has(type));
  const options = DOCUMENT_OPTIONS.filter((option) => !lockedTypes.includes(option.value as VerificationDocumentType));
  const selectedType = options.some((option) => option.value === documentType) ? documentType : (options[0]?.value as VerificationDocumentType);

  function handleSubmit() {
    if (!mediaAssetId) return;
    submit.mutate(
      { documentType: selectedType, mediaAssetId },
      {
        onSuccess: () => {
          setMediaAssetId(null);
          setUploadKey((key) => key + 1);
        },
      },
    );
  }

  function confirmDelete() {
    if (!toDelete) return;
    remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) });
  }

  const deletingIdentity = toDelete?.documentType === 'IDENTITY';

  return (
    <div className="gm-form">
      <p>
        Holat: <TrustBadge verification={trust.data.verification} />
      </p>
      {documents.length === 0 && <EmptyState title="Hali hujjat yuborilmagan" />}
      <div className="gm-list">
        {documents.map((document) => (
          <div key={document.id} className="gm-card">
            <div className="gm-card__header">
              <h3>{DOCUMENT_OPTIONS.find((option) => option.value === document.documentType)?.label}</h3>
              <TrustBadge verification={document.status} />
            </div>
            {document.rejectionReason && <p>Sabab: {document.rejectionReason}</p>}
            <p className="gm-card__meta">Yuborildi: {formatDate(document.createdAt)}</p>
            <div className="gm-action-row">
              <Button size="sm" variant="ghost" onClick={() => setToDelete(document)}>
                <Trash2 size={14} /> O‘chirish
              </Button>
            </div>
          </div>
        ))}
      </div>

      <h3>Yangi hujjat yuborish</h3>
      {lockedTypes.length > 0 && (
        <Alert tone="info">
          {lockedTypes.map((type) => DOCUMENT_OPTIONS.find((option) => option.value === type)?.label).join(' va ')} yuklangan. Almashtirish uchun avval yuqoridan
          o‘chiring, keyin yangisini yuklang.
        </Alert>
      )}
      {submit.isError && <Alert tone="danger">{getErrorMessage(submit.error)}</Alert>}
      <Select
        label="Hujjat turi"
        options={options}
        value={selectedType}
        onChange={(event) => setDocumentType(event.target.value as VerificationDocumentType)}
      />
      <MediaUploadField
        key={uploadKey}
        label="Hujjat fayli"
        accept="image/*"
        kind="MASTER_VERIFICATION_DOCUMENT"
        linkType="MasterProfile"
        linkId={masterId}
        onReady={setMediaAssetId}
      />
      <Button onClick={handleSubmit} disabled={!mediaAssetId} loading={submit.isPending}>
        Tasdiqlashga yuborish
      </Button>

      <ConfirmDialog
        open={!!toDelete}
        title="Hujjatni o‘chirish"
        description={
          deletingIdentity
            ? 'Shaxsni tasdiqlovchi hujjat o‘chirilsa, profilingiz “Tasdiqlanmagan” holatga o‘tadi va nofaol bo‘ladi. Qayta faollashish uchun hujjatni yangidan yuklab, tasdiqlatishingiz kerak.'
            : 'Hujjat o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.'
        }
        confirmLabel="O‘chirish"
        cancelLabel="Yopish"
        tone="danger"
        loading={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      >
        {remove.isError && <Alert tone="danger">{getErrorMessage(remove.error)}</Alert>}
      </ConfirmDialog>
    </div>
  );
}
