import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { otpSchema, type OtpFormValues } from '../validation';
import { t } from '@/i18n';

const OTP_TTL_SECONDS = 300;

export interface OtpFormProps {
  phone: string;
  loading: boolean;
  error: unknown;
  onSubmit: (values: { code: string }) => void;
  onExpiredHint: string;
  /** Yangi kod so‘rash (faqat ro‘yxatdan o‘tish bosqichida). Muvaffaqiyatli bo‘lsa true qaytaradi. */
  onResend?: () => Promise<boolean>;
}

/** Kodni qayta yuborish 2 daqiqadan keyin mumkin (backend: OTP_RESEND_SECONDS=120 bilan mos). */
const RESEND_COOLDOWN_SECONDS = 120;

const clock = (total: number) => `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;

export function OtpForm({ phone, loading, error, onSubmit, onExpiredHint, onResend }: OtpFormProps) {
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL_SECONDS);
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OtpFormValues>({ resolver: zodResolver(otpSchema) });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
      setResendIn((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const expired = secondsLeft === 0;

  async function resend() {
    if (!onResend || resending) return;
    setResending(true);
    const ok = await onResend().catch(() => false);
    setResending(false);
    if (ok) {
      setSecondsLeft(OTP_TTL_SECONDS);
      setResendIn(RESEND_COOLDOWN_SECONDS);
    }
  }
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  return (
    <form className="gm-auth-form" onSubmit={(e) => void handleSubmit((values) => onSubmit({ code: values.code }))(e)} noValidate>
      {!!error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
      <p className="gm-auth-form__hint">
        <strong>+{phone.replace('+', '')}</strong> {t('raqamiga yuborilgan 6 xonali kodni kiriting.')}
      </p>

      <Input
        label={t('Tasdiqlash kodi')}
        inputMode="numeric"
        maxLength={6}
        required
        disabled={expired}
        error={errors.code?.message}
        {...register('code')}
      />

      {expired ? (
        <Alert tone="warning">{onExpiredHint}</Alert>
      ) : (
        <p className="gm-auth-form__countdown" aria-live="polite">
          {t('Kod amal qilish muddati:')} {minutes}:{seconds}
        </p>
      )}

      <Button type="submit" loading={loading} disabled={expired} fullWidth>
        {t('Tasdiqlash')}
      </Button>

      {onResend && (
        <Button type="button" variant="secondary" fullWidth loading={resending} disabled={resendIn > 0 && !expired} onClick={() => void resend()}>
          {expired ? t('Yangi kod yuborish') : resendIn > 0 ? t('Kodni qayta yuborish ({time})', { time: clock(resendIn) }) : t('Kod kelmadimi? Qayta yuborish')}
        </Button>
      )}
    </form>
  );
}
