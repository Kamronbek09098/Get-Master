import { Link, Navigate } from 'react-router-dom';
import { RegisterForm } from '@/features/auth/components/RegisterForm';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/auth.store';

export function RegisterPage() {
  const isAdmin = useAuthStore((s) => s.preferredRole) === 'ADMIN';
  if (isAdmin) return <Navigate to="/login" replace />;

  return (
    <div className="gm-auth-page">
      <h1>Ro‘yxatdan o‘tish</h1>
      <p className="gm-auth-page__subtitle">{env.appRole === 'MASTER'
          ? 'Ro‘yxatdan o‘ting, so‘ng usta profilingizni to‘ldiring.'
          : 'Mijoz sifatida ro‘yxatdan o‘ting va birinchi so‘rovingizni yarating.'}</p>
      <RegisterForm />
      <p className="gm-auth-page__switch">
        Akkauntingiz bormi? <Link to="/login">Kirish</Link>
      </p>
    </div>
  );
}
