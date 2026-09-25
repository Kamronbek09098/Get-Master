import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { useRegister } from '../hooks/useAuth';
import { registerSchema, toFullPhone, type RegisterFormValues } from '../validation';

export function RegisterForm() {
  const navigate = useNavigate();
  const register_ = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  function onSubmit(values: RegisterFormValues) {
    register_.mutate(
      {
        phone: toFullPhone(values.phoneLocal),
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email || undefined,
      },
      { onSuccess: (result) => navigate('/otp', { state: { flow: result.existingAccount ? 'login' : 'register' } }) },
    );
  }

  return (
    <form className="gm-auth-form" onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
      {register_.isError && <Alert tone="danger">{getErrorMessage(register_.error)}</Alert>}

      <div className="gm-phone-field">
        <span className="gm-phone-field__prefix" aria-hidden="true">
          +998
        </span>
        <Input
          label="Telefon raqami"
          inputMode="numeric"
          placeholder="901234567"
          required
          error={errors.phoneLocal?.message}
          {...register('phoneLocal')}
        />
      </div>
      <Input label="Ism" required {...register('firstName')} error={errors.firstName?.message} />
      <Input label="Familiya" required {...register('lastName')} error={errors.lastName?.message} />
      <Input label="Email (ixtiyoriy)" type="email" {...register('email')} error={errors.email?.message} />
      <Input
        label="Parol"
        type="password"
        autoComplete="new-password"
        required
        error={errors.password?.message}
        {...register('password')}
      />
      <Input
        label="Parolni takrorlang"
        type="password"
        autoComplete="new-password"
        required
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      <Checkbox
        label="Foydalanish shartlari, Maxfiylik siyosati va Platforma qoidalarini qabul qilaman"
        error={errors.acceptedTerms?.message}
        {...register('acceptedTerms')}
      />
      <Button type="submit" loading={register_.isPending} fullWidth>
        Ro‘yxatdan o‘tish
      </Button>
    </form>
  );
}
