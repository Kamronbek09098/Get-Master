import { Link } from 'react-router-dom';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/auth.store';

export function LoginPage() {
  const isAdmin = useAuthStore((s) => s.preferredRole) === 'ADMIN';

  return (
    <div className="gm-auth-page">
      <h1>{isAdmin ? 'Administrator kirishi' : 'Kirish'}</h1>
      <p className="gm-auth-page__subtitle">Telefon raqami va parolingiz bilan kiring.</p>
      <LoginForm />
      {isAdmin ? (
        !env.appRole && (
          <p className="gm-auth-page__switch">
            <Link to="/">Boshqa rolni tanlash</Link>
          </p>
        )
      ) : (
        <p className="gm-auth-page__switch">
          Akkauntingiz yo‘qmi? <Link to="/register">Ro‘yxatdan o‘tish</Link>
        </p>
      )}
    </div>
  );
}
