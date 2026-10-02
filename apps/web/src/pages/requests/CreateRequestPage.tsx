import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { RequestForm } from '@/features/request/components/RequestForm';
import { RequestSteps } from '@/features/request/components/RequestSteps';
import { useSubmitRequest } from '@/features/request/hooks/useRequests';
import { MediaUploadField } from '@/features/media/components/MediaUploadField';
import type { ProblemRequest } from '@/features/request/types';
import { t } from '@/i18n';

export function CreateRequestPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<ProblemRequest | null>(null);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [uploadKey, setUploadKey] = useState(0);
  const submitRequest = useSubmitRequest(draft?.id ?? '');

  if (!draft) {
    return (
      <div>
        <div className="gm-page-header">
          <h1>{t('Yangi so‘rov')}</h1>
          <p style={{ color: 'var(--gm-color-text-muted)', margin: 0 }}>{t('Muammoni yozing — mos ustalar sizga narx bilan taklif yuboradi.')}</p>
        </div>
        <RequestSteps current={1} />
        <RequestForm onCreated={setDraft} />
      </div>
    );
  }

  return (
    <div>
      <div className="gm-page-header">
        <h1>{t('Rasm biriktiring (ixtiyoriy)')}</h1>
      </div>
      <RequestSteps current={2} />
      <div className="gm-form-card" style={{ maxWidth: 640 }}>
      <p style={{ color: 'var(--gm-color-text-muted)', marginBottom: 'var(--gm-space-4)' }}>{t('“{title}” so‘rovi yaratildi. Muammoni ko‘rsatuvchi fotosurat qo‘shishingiz mumkin, keyin so‘rovni yuboring.', { title: draft.title })}</p>

      <MediaUploadField
        key={uploadKey}
        label={t('Foto {p}', { p: attachmentCount + 1 })}
        kind="PROBLEM_ATTACHMENT"
        linkType="ProblemRequest"
        linkId={draft.id}
        onReady={() => {
          setAttachmentCount((c) => c + 1);
          setUploadKey((k) => k + 1);
        }}
      />

      {submitRequest.isError && <Alert tone="danger">{getErrorMessage(submitRequest.error)}</Alert>}

      <div style={{ display: 'flex', gap: 'var(--gm-space-2)', marginTop: 'var(--gm-space-5)' }}>
        <Button
          loading={submitRequest.isPending}
          onClick={() =>
            submitRequest.mutate(undefined, {
              onSuccess: (updated) => navigate(`/mijozlar/sorovlar/${updated.id}`, { replace: true }),
            })
          }
        >{t('So‘rovni yuborish')}</Button>
        <Button variant="ghost" onClick={() => navigate(`/mijozlar/sorovlar/${draft.id}`, { replace: true })}>{t('Keyinroq yuborish')}</Button>
      </div>
      </div>
    </div>
  );
}
