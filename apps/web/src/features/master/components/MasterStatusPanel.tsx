import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { statusLabel } from '@/lib/labels';
import { getErrorMessage } from '@/lib/error-messages';
import { useMasterAvailabilityStatus } from '../hooks/useMasterManage';
import type { MasterProfile } from '../types';

export function MasterStatusPanel({ profile }: { profile: MasterProfile }) {
  const { setStatus, pause, resume } = useMasterAvailabilityStatus();
  const [reason, setReason] = useState('');
  const error = setStatus.error ?? pause.error ?? resume.error;
  const locked = profile.status === 'RESTRICTED' || profile.status === 'SUSPENDED';
  const verified = profile.verification === 'VERIFIED';

  return (
    <div className="gm-form">
      {error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
      <p>
        Hozirgi holat:{' '}
        {profile.isPaused ? <Badge tone="warning">Pauza</Badge> : <Badge tone={profile.status === 'ACTIVE' ? 'success' : 'neutral'}>{statusLabel(profile.status)}</Badge>}
      </p>
      {locked && <Alert tone="warning">Profilingiz cheklangan. Batafsil ma’lumot uchun «Choralar va apellyatsiya» bo‘limini oching.</Alert>}
      {!locked && profile.isPaused && (
        <Button loading={resume.isPending} onClick={() => resume.mutate()}>
          Ishni davom ettirish
        </Button>
      )}
      {!locked && !profile.isPaused && (
        <>
          <div className="gm-action-row">
            <Button
              size="sm"
              variant="secondary"
              loading={setStatus.isPending}
              disabled={profile.status !== 'ACTIVE' && !verified}
              onClick={() => setStatus.mutate(profile.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}
            >
              {profile.status === 'ACTIVE' ? 'Nofaol qilish' : 'Faollashtirish'}
            </Button>
          </div>
          {!verified && profile.status !== 'ACTIVE' && (
            <p className="gm-card__meta">Faollashtirish uchun avval profilingiz tasdiqlanishi kerak.</p>
          )}
          <div className="gm-inline-form">
            <Input label="Pauza sababi" value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} />
            <Button
              variant="secondary"
              disabled={!reason.trim()}
              loading={pause.isPending}
              onClick={() => pause.mutate({ reason: reason.trim() }, { onSuccess: () => setReason('') })}
            >
              Pauzaga qo‘yish
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
