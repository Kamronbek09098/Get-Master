import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { getNavItems } from '@/components/layout/nav-items';
import { useAuthStore } from '@/store/auth.store';
import { getErrorMessage } from '@/lib/error-messages';
import { useLogin } from '../hooks/useAuth';
import { formatLocalPhone, toLocalDigits, loginSchema, toFullPhone, type LoginFormValues } from '../validation';

export function LoginForm() {
  const navigate = useNavigate();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  function onSubmit(values: LoginFormValues) {
    login.mutate(
      { phone: toFullPhone(toLocalDigits(values.phoneLocal)), password: values.password },
      {
        onSuccess: (result) => {
          if (result.verificationRequired) {
            navigate('/otp', { state: { flow: 'login' } });
            return;
          }
          const [firstItem] = getNavItems(useAuthStore.getState().preferredRole, { superAdmin: true });
          navigate(firstItem?.to ?? '/', { replace: true });
        },
      },
    );
  }

  return (
    <form className="gm-auth-form" onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
      {login.isError && <Alert tone="danger">{getErrorMessage(login.error)}</Alert>}

      <Input
        label="Telefon raqami"
        prefix="+998"
        inputMode="numeric"
        placeholder="90 123 45 67"
        autoComplete="tel-national"
        maxLength={12}
        formatValue={formatLocalPhone}
        required
        error={errors.phoneLocal?.message}
        {...register('phoneLocal')}
      />
      <Input label="Parol" type="password" required error={errors.password?.message} {...register('password')} />
      <Button type="submit" loading={login.isPending} fullWidth className="gm-auth-submit">
        Kirish <ArrowRight size={18} />
      </Button>
    </form>
  );
}
