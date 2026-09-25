import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { OtpForm } from '@/features/auth/components/OtpForm';
import { useVerifyOtp, useVerifyRegistration } from '@/features/auth/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';
import { Alert } from '@/components/ui/Alert';
import { APP_TITLE } from '@/lib/panel';
import { getNavItems } from '@/components/layout/nav-items';

type Flow = 'register' | 'login';

export function OtpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const pendingPhone = useAuthStore((s) => s.pendingPhone);
  const preferredRole = useAuthStore((s) => s.preferredRole);
  const devCode = useAuthStore((s) => s.devCode);
  const flow: Flow = (location.state as { flow?: Flow } | null)?.flow ?? 'login';

  const verifyRegistration = useVerifyRegistration();
  const verifyOtp = useVerifyOtp();

  useEffect(() => {
    document.title = flow === 'register' ? `Ro‘yxatdan o‘tishni tasdiqlash — ${APP_TITLE}` : `Kirishni tasdiqlash — ${APP_TITLE}`;
  }, [flow]);

  if (!pendingPhone) {
    return <Navigate to={flow === 'register' ? '/register' : '/login'} replace />;
  }

  const isRegisterFlow = flow === 'register';
  const mutation = isRegisterFlow ? verifyRegistration : verifyOtp;

  function handleSubmit(values: { code: string }) {
    if (isRegisterFlow) {
      verifyRegistration.mutate(
        { phone: pendingPhone as string, code: values.code },
        { onSuccess: () => navigate('/login', { replace: true }) },
      );
      return;
    }
    verifyOtp.mutate(
      { phone: pendingPhone as string, code: values.code },
      {
        onSuccess: () => {
          const [firstItem] = getNavItems(preferredRole);
          navigate(firstItem?.to ?? '/', { replace: true });
        },
      },
    );
  }

  return (
    <div className="gm-auth-page">
      <h1>{isRegisterFlow ? 'Ro‘yxatdan o‘tishni tasdiqlash' : 'Kirishni tasdiqlash'}</h1>
      {devCode && (
        <Alert tone="info" title="Dev rejim">
          Tasdiqlash kodi: <strong>{devCode}</strong>
        </Alert>
      )}
      <OtpForm
        phone={pendingPhone}
        loading={mutation.isPending}
        error={mutation.error}
        onSubmit={handleSubmit}
        onExpiredHint={
          isRegisterFlow
            ? 'Kod eskirdi. Hozircha bu telefon raqami uchun ro‘yxatdan o‘tishni qayta boshlashning iloji yo‘q — bu backend’dagi maʻlum cheklov (hisobotga qarang). Iltimos, qo‘llab-quvvatlash xizmatiga murojaat qiling.'
            : 'Kod eskirdi. Login sahifasiga qaytib, telefon raqami va parolingizni qayta kiriting — yangi kod shu tarzda yuboriladi.'
        }
      />
    </div>
  );
}
