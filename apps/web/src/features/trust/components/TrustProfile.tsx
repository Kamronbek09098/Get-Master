import { useState } from 'react';
import { FileCheck2, FileText, FileX2, ShieldCheck, Trash2 } from 'lucide-react';
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
import './TrustProfile.css';

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
  // Tekshiruvda turgan yoki tasdiqlangan hujjat turi qulflanadi (avval o‘chirish kerak).
  // Rad etilgan / tuzatish so‘ralgan / muddati tugagan hujjat turini qayta yuborish mumkin: eskisi nofaol bo‘ladi.
  const BLOCKING = ['PENDING', 'UNDER_REVIEW', 'VERIFIED'];
  const lockedTypes = SINGLE_TYPES.filter((type) => documents.some((document) => document.documentType === type && BLOCKING.includes(String(document.status))));
  const REPLACEABLE = ['CORRECTION_REQUESTED', 'REJECTED', 'EXPIRED'];
  const replaceableTypes = [...new Set(documents.filter((document) => REPLACEABLE.includes(String(document.status))).map((document) => document.documentType))].filter(
    (type) => !lockedTypes.includes(type as VerificationDocumentType),
  );
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
    <div className="gm-form gm-trustp">
      <p className="gm-trustp__status">
        Holat: <TrustBadge verification={trust.data.verification} />
      </p>
      {documents.length === 0 && <EmptyState title="Hali hujjat yuborilmagan" />}
      <div className="gm-list">
        {documents.map((document) => {
          const status = String(document.status);
          const Icon = status === 'VERIFIED' || status === 'APPROVED' ? FileCheck2 : status === 'REJECTED' ? FileX2 : FileText;
          return (
            <div key={document.id} className={status === 'INACTIVE' ? 'gm-doc-card gm-doc-card--inactive' : 'gm-doc-card'}>
              <span className={`gm-doc-card__icon gm-doc-card__icon--${status.toLowerCase()}`} aria-hidden="true">
                <Icon size={20} />
              </span>
              <div className="gm-doc-card__body">
                <h3>{DOCUMENT_OPTIONS.find((option) => option.value === document.documentType)?.label}</h3>
                <div className="gm-doc-card__meta">
                  <TrustBadge verification={document.status} />
                  <span>Yuborildi: {formatDate(document.createdAt)}</span>
                </div>
                {document.rejectionReason && status !== 'INACTIVE' && <p className="gm-doc-card__reason">Sabab: {document.rejectionReason}</p>}
              </div>
              {status !== 'INACTIVE' && (
                <Button size="sm" variant="secondary" className="gm-btn-tone gm-btn-tone--danger gm-doc-card__delete" onClick={() => setToDelete(document)}>
                  <Trash2 size={15} /> O‘chirish
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <section className="gm-trustp__new">
      <h3>Yangi hujjat yuborish</h3>
      <p className="gm-trustp__lead">Hujjat turini tanlang va fayl yuklang — administrator tekshirib chiqadi.</p>
      {lockedTypes.length > 0 && (
        <Alert tone="info">
          {lockedTypes.map((type) => DOCUMENT_OPTIONS.find((option) => option.value === type)?.label).join(' va ')} yuklangan. Almashtirish uchun avval yuqoridan
          o‘chiring, keyin yangisini yuklang.
        </Alert>
      )}
      {replaceableTypes.length > 0 && (
        <Alert tone="warning">
          {replaceableTypes.map((type) => DOCUMENT_OPTIONS.find((option) => option.value === type)?.label).join(' va ')} qayta yuborilishi kerak. Shu hujjat turini tanlab yangisini yuklang —
          oldingisi nofaol holatga o‘tadi.
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
      <Button size="lg" fullWidth className="gm-trust-submit" onClick={handleSubmit} disabled={!mediaAssetId} loading={submit.isPending}>
        <ShieldCheck size={18} /> Tasdiqlashga yuborish
      </Button>
      {!mediaAssetId && <p className="gm-trust-submit__hint">Avval hujjat faylini yuklang — shundan keyin yuborish mumkin bo‘ladi.</p>}
      </section>

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
