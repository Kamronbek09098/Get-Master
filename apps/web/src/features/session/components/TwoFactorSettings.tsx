import { useState } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { getErrorMessage } from '@/lib/error-messages';
import { ApiError } from '@/types/api';
import { useAppStore } from '@/store/app.store';
import { useMe } from '../hooks/useMe';
import { useSetTwoFactor } from '../hooks/useTwoFactor';
import './TwoFactorSettings.css';

/**
 * Ikki bosqichli autentifikatsiya: yoqilgan bo‘lsa kirishda doim SMS/OTP kod so‘raladi, o‘chirilgan bo‘lsa faqat login va parol.
 * O‘chirish uchun joriy parol talab qilinadi. Administrator akkaunti uchun doim yoqilgan.
 */
/** Bu yerda 401 — joriy parol noto‘g‘ri (telefon raqami kiritilmaydi), shuning uchun kirish xatosi matni ishlatilmaydi. */
const twoFactorError = (error: unknown) => (error instanceof ApiError && error.code === 'UNAUTHORIZED' ? 'Kiritilgan parol noto‘g‘ri.' : getErrorMessage(error));

export function TwoFactorSettings() {
  const me = useMe();
  const setTwoFactor = useSetTwoFactor();
  const pushToast = useAppStore((s) => s.pushToast);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState('');

  if (me.isLoading || !me.data) return <Skeleton style={{ height: 120, borderRadius: 16 }} />;
  const wrongPassword = setTwoFactor.error instanceof ApiError && setTwoFactor.error.code === 'UNAUTHORIZED';
  const enabled = me.data.twoFactorEnabled !== false;

  function closeConfirm() {
    if (setTwoFactor.isPending) return;
    setConfirmOpen(false);
    setPassword('');
    setTwoFactor.reset();
  }

  function handleToggle(next: boolean) {
    if (next) {
      setTwoFactor.mutate({ enabled: true }, { onSuccess: () => pushToast('Ikki bosqichli autentifikatsiya yoqildi.', 'success') });
    } else {
      setConfirmOpen(true);
    }
  }

  function confirmDisable() {
    setTwoFactor.mutate(
      { enabled: false, password },
      {
        onSuccess: () => {
          pushToast('Ikki bosqichli autentifikatsiya o‘chirildi.', 'success');
          setConfirmOpen(false);
          setPassword('');
        },
      },
    );
  }

  return (
    <section className="gm-detail-section gm-twofa" aria-labelledby="gm-twofa-title">
      <div className="gm-twofa__head">
        <span className={enabled ? 'gm-twofa__icon gm-twofa__icon--on' : 'gm-twofa__icon'} aria-hidden="true">
          {enabled ? <ShieldCheck size={22} /> : <ShieldOff size={22} />}
        </span>
        <div className="gm-twofa__title">
          <h2 id="gm-twofa-title">Ikki bosqichli autentifikatsiya</h2>
          <Badge tone={enabled ? 'success' : 'warning'}>{enabled ? 'Yoqilgan' : 'O‘chirilgan'}</Badge>
        </div>
      </div>

      <p className="gm-twofa__text">
        {enabled
          ? 'Akkauntga har safar kirganingizda login va paroldan keyin telefoningizga kelgan tasdiqlash kodi ham so‘raladi. Bu akkauntingizni begonalardan himoya qiladi.'
          : 'Hozir akkauntga faqat login va parol bilan kiriladi, tasdiqlash kodi so‘ralmaydi. Xavfsizlik uchun ikki bosqichli autentifikatsiyani yoqib qo‘yish tavsiya etiladi.'}
      </p>

      {setTwoFactor.isError && !confirmOpen && <Alert tone="danger">{twoFactorError(setTwoFactor.error)}</Alert>}

      <div className="gm-twofa__switch">
        <Switch label={enabled ? 'Kirishda kod so‘ralsin' : 'Kirishda kod so‘ralmaydi'} checked={enabled} disabled={setTwoFactor.isPending} onChange={handleToggle} />
      </div>

      <Modal
        open={confirmOpen}
        onClose={closeConfirm}
        title="Ikki bosqichli autentifikatsiyani o‘chirish"
        footer={
          <>
            <Button variant="secondary" onClick={closeConfirm} disabled={setTwoFactor.isPending}>
              Bekor qilish
            </Button>
            <Button variant="danger" loading={setTwoFactor.isPending} disabled={password.length < 1} onClick={confirmDisable}>
              O‘chirish
            </Button>
          </>
        }
      >
        <form
          className="gm-twofa__form"
          onSubmit={(event) => {
            event.preventDefault();
            if (password) confirmDisable();
          }}
          noValidate
        >
          <Alert tone="warning" title="Xavfsizlik pasayadi">
            O‘chirilgach, akkauntga faqat login va parol bilan kiriladi. Parolingiz o‘g‘irlansa, akkauntingizga begona kira oladi.
          </Alert>
          <Input
            label="Joriy parol"
            type="password"
            aria-required="true"
            autoComplete="current-password"
            autoFocus
            placeholder="Parolingizni kiriting"
            value={password}
            error={wrongPassword ? twoFactorError(setTwoFactor.error) : undefined}
            onChange={(event) => {
              setPassword(event.target.value);
              if (setTwoFactor.isError) setTwoFactor.reset();
            }}
          />
          {setTwoFactor.isError && !wrongPassword && <Alert tone="danger">{twoFactorError(setTwoFactor.error)}</Alert>}
        </form>
      </Modal>
    </section>
  );
}
