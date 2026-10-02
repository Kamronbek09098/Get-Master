import { useEffect, useState } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { NewCredentialsCard } from '@/features/auth/components/NewCredentialsCard';
import { OtpForm } from '@/features/auth/components/OtpForm';
import { useVerifyOtp, useVerifyRegistration } from '@/features/auth/hooks/useAuth';
import { loginSecret } from '@/features/auth/login-secret';
import { authService } from '@/features/auth/services/auth.service';
import { useAppStore } from '@/store/app.store';
import { useAuthStore } from '@/store/auth.store';
import { Alert } from '@/components/ui/Alert';
import { getErrorMessage } from '@/lib/error-messages';
import { APP_TITLE } from '@/lib/panel';
import { getNavItems } from '@/components/layout/nav-items';

type Flow = 'register' | 'login';

export function OtpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const pendingPhone = useAuthStore((s) => s.pendingPhone);
  const preferredRole = useAuthStore((s) => s.preferredRole);
  const devCode = useAuthStore((s) => s.devCode);
  const deviceLimit = useAuthStore((s) => s.deviceLimit);
  const hasNewCredentials = useAuthStore((s) => s.newCredentials !== null);
  const [created, setCreated] = useState(false);
  const setDevCode = useAuthStore((s) => s.setDevCode);
  const pushToast = useAppStore((s) => s.pushToast);
  const [resendError, setResendError] = useState<unknown>(null);
  const flow: Flow = (location.state as { flow?: Flow } | null)?.flow ?? 'login';

  const verifyRegistration = useVerifyRegistration();
  const verifyOtp = useVerifyOtp();

  useEffect(() => {
    document.title = flow === 'register' ? `Ro‘yxatdan o‘tishni tasdiqlash — ${APP_TITLE}` : `Kirishni tasdiqlash — ${APP_TITLE}`;
  }, [flow]);

  if (created) {
    return (
      <div className="gm-auth-page">
        <NewCredentialsCard onContinue={() => navigate('/login', { replace: true })} />
      </div>
    );
  }

  if (!pendingPhone) {
    return <Navigate to={flow === 'register' ? '/register' : '/login'} replace />;
  }

  const isRegisterFlow = flow === 'register';
  const mutation = isRegisterFlow ? verifyRegistration : verifyOtp;

  async function handleResend(): Promise<boolean> {
    setResendError(null);
    try {
      const password = isRegisterFlow ? null : loginSecret.get(pendingPhone as string);
      const result = isRegisterFlow
        ? await authService.resendRegistration(pendingPhone as string)
        : await authService.login({ phone: pendingPhone as string, password: password as string });
      setDevCode(result.developmentCode ?? null);
      pushToast('Yangi kod yuborildi.', 'success');
      return true;
    } catch (error) {
      setResendError(error);
      return false;
    }
  }

  function handleSubmit(values: { code: string }) {
    if (isRegisterFlow) {
      verifyRegistration.mutate(
        { phone: pendingPhone as string, code: values.code },
        {
          onSuccess: () => {
            // Login va parol bir marta ko‘rsatiladi; ko‘rsatiladigan narsa bo‘lmasa — to‘g‘ridan-to‘g‘ri kirishga.
            if (hasNewCredentials) setCreated(true);
            else navigate('/login', { replace: true });
          },
        },
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
      {!isRegisterFlow && deviceLimit && (
        <div className="gm-devlimit" role="alert">
          <span className="gm-devlimit__icon" aria-hidden="true">
            <MonitorSmartphone size={20} />
          </span>
          <div>
            <strong>Qurilmalar limiti to‘lgan ({deviceLimit.active}/{deviceLimit.max})</strong>
            <p>
              Akkauntingizda faol qurilmalar soni chegaraga yetgan, shuning uchun bu qurilmadan kirish kodni to‘g‘ri kiritsangiz ham rad etiladi. Avval boshqa
              qurilmangizdan «Sozlamalar → Faol qurilmalar» orqali chiqing, so‘ng bu yerga qaytib login qiling.
            </p>
          </div>
        </div>
      )}
      {isRegisterFlow && verifyRegistration.isError && (
        <Alert tone="info" title="Kod mos kelmadimi?">
          Agar bu telefon raqami bilan avval ro‘yxatdan o‘tgan bo‘lsangiz, <Link to="/login">kirish sahifasidan</Link> foydalaning. Aks holda kodni qayta tekshirib kiriting.
        </Alert>
      )}
      {!!resendError && <Alert tone="danger">{getErrorMessage(resendError)}</Alert>}
      <OtpForm
        phone={pendingPhone}
        loading={mutation.isPending}
        error={mutation.error}
        onSubmit={handleSubmit}
        onResend={isRegisterFlow || loginSecret.get(pendingPhone) ? handleResend : undefined}
        onExpiredHint={
          isRegisterFlow
            ? 'Kod eskirdi. Yangi kod yuborilishini so‘rang yoki qaytadan urinib ko‘ring.'
            : 'Kod eskirdi. Login sahifasiga qaytib, telefon raqami va parolingizni qayta kiriting — yangi kod shu tarzda yuboriladi.'
        }
      />
    </div>
  );
}
