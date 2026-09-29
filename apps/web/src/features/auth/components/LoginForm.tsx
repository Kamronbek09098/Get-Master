import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { useLogin } from '../hooks/useAuth';
import { loginSchema, toFullPhone, type LoginFormValues } from '../validation';

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
      { phone: toFullPhone(values.phoneLocal), password: values.password },
      { onSuccess: () => navigate('/otp', { state: { flow: 'login' } }) },
    );
  }

  return (
    <form className="gm-auth-form" onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
      {login.isError && <Alert tone="danger">{getErrorMessage(login.error)}</Alert>}

      <Input
        label="Telefon raqami"
        prefix="+998"
        inputMode="numeric"
        placeholder="901234567"
        required
        error={errors.phoneLocal?.message}
        {...register('phoneLocal')}
      />
      <Input label="Parol" type="password" required error={errors.password?.message} {...register('password')} />
      <Button type="submit" loading={login.isPending} fullWidth>
        Kirish
      </Button>
    </form>
  );
}
