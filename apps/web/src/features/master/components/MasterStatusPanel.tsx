import { Lock, Pause, Play, Power, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { statusLabel } from '@/lib/labels';
import { getErrorMessage } from '@/lib/error-messages';
import { useMasterAvailabilityStatus } from '../hooks/useMasterManage';
import type { MasterProfile } from '../types';
import { t } from '@/i18n';

export function MasterStatusPanel({ profile }: { profile: MasterProfile }) {
  const { setStatus, pause, resume } = useMasterAvailabilityStatus();
  const [reason, setReason] = useState('');
  const error = setStatus.error ?? pause.error ?? resume.error;
  const locked = profile.status === 'RESTRICTED' || profile.status === 'SUSPENDED';
  const verified = profile.verification === 'VERIFIED';

  const active = profile.status === 'ACTIVE';
  const canPause = active || profile.status === 'BUSY';

  const state = profile.isPaused ? 'paused' : active ? 'active' : 'inactive';
  const stateText = profile.isPaused
    ? profile.status === 'ACTIVE'
      ? t('Vaqtincha buyurtma olmayapsiz')
      : t('Profil nofaol va pauzada')
    : active
      ? t('Mijozlar sizni topadi, takliflar keladi')
      : t('Mijozlarga ko‘rinmaysiz, takliflar kelmaydi');

  return (
    <div className="gm-form gm-statuspanel">
      {error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}

      <div className={`gm-status gm-status--${state}`}>
        <span className="gm-status__orb" aria-hidden="true">
          {profile.isPaused ? <Pause size={22} /> : <Power size={22} />}
        </span>
        <div className="gm-status__text">
          <small>{t('Hozirgi holat')}</small>
          <strong>{profile.isPaused ? t('Pauzada') : statusLabel(profile.status)}</strong>
          <span>{stateText}</span>
          {profile.isPaused && profile.pauseReason && <span className="gm-status__reason">{t('Sabab:')}{' '}{profile.pauseReason}</span>}
        </div>
        {!locked && (
          <div className="gm-status__action">
            {profile.isPaused ? (
              <Button className="gm-sbtn" loading={resume.isPending} onClick={() => resume.mutate()}>
                <Play size={16} />{' '}{t('Davom ettirish')}</Button>
            ) : (
              <Button
                variant={active ? 'secondary' : 'primary'}
                className={active ? 'gm-sbtn gm-sbtn--off' : 'gm-sbtn'}
                loading={setStatus.isPending}
                disabled={!active && !verified}
                onClick={() => setStatus.mutate(active ? 'INACTIVE' : 'ACTIVE')}
              >
                {!active && !verified ? <Lock size={16} /> : <Power size={16} />} {active ? t('Nofaol qilish') : t('Faollashtirish')}
              </Button>
            )}
          </div>
        )}
      </div>

      {locked && <Alert tone="warning">{t('Profilingiz cheklangan. Batafsil ma’lumot uchun «Choralar va apellyatsiya» bo‘limini oching.')}</Alert>}

      {!locked && !profile.isPaused && (
        <>
          {!verified && !active && (
            <div className="gm-pnote">
              <ShieldAlert size={18} aria-hidden="true" />
              <span>{t('Faollashtirish uchun avval profilingiz tasdiqlanishi kerak.')}<a href="#tasdiqlash" className="gm-pnote__link">{t('Hujjat yuborish')}</a>
              </span>
            </div>
          )}

          <section className={canPause ? 'gm-pausecard' : 'gm-pausecard is-locked'} aria-label={t('Pauza')}>
            <header className="gm-pausecard__head">
              <span className="gm-pausecard__icon" aria-hidden="true">
                <Pause size={18} />
              </span>
              <div>
                <h3>{t('Vaqtincha pauza')}</h3>
                <p>{canPause ? t('Ta’til yoki band kunlarda buyurtmalarni to‘xtatib turing.') : t('Pauza faqat faol profil uchun ishlaydi — avval profilni faollashtiring.')}</p>
              </div>
            </header>
            <div className="gm-pausecard__row">
              <Input label={t('Pauza sababi')} placeholder={t('Masalan: ta’tildaman')} disabled={!canPause} value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} />
              <Button
                variant="secondary"
                className="gm-sbtn gm-sbtn--pause"
                disabled={!canPause || !reason.trim()}
                loading={pause.isPending}
                onClick={() => pause.mutate({ reason: reason.trim() }, { onSuccess: () => setReason('') })}
              >
                <Pause size={16} />{' '}{t('Pauzaga qo‘yish')}</Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
