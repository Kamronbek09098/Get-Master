import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { otpSchema, type OtpFormValues } from '../validation';

const OTP_TTL_SECONDS = 300;

export interface OtpFormProps {
  phone: string;
  loading: boolean;
  error: unknown;
  onSubmit: (values: { code: string }) => void;
  onExpiredHint: string;
}

export function OtpForm({ phone, loading, error, onSubmit, onExpiredHint }: OtpFormProps) {
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL_SECONDS);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OtpFormValues>({ resolver: zodResolver(otpSchema) });

  useEffect(() => {
    const timer = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const expired = secondsLeft === 0;
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  return (
    <form className="gm-auth-form" onSubmit={(e) => void handleSubmit((values) => onSubmit({ code: values.code }))(e)} noValidate>
      {!!error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
      <p className="gm-auth-form__hint">
        <strong>+{phone.replace('+', '')}</strong> raqamiga yuborilgan 6 xonali kodni kiriting.
      </p>

      <Input
        label="Tasdiqlash kodi"
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
          Kod amal qilish muddati: {minutes}:{seconds}
        </p>
      )}

      <Button type="submit" loading={loading} disabled={expired} fullWidth>
        Tasdiqlash
      </Button>
    </form>
  );
}
