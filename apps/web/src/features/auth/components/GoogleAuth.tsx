import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { env } from '@/lib/env';
import { getErrorMessage } from '@/lib/error-messages';
import { getNavItems } from '@/components/layout/nav-items';
import { useAuthStore } from '@/store/auth.store';
import { authService } from '../services/auth.service';
import { googlePending } from '../google-pending';
import { formatLocalPhone, localPhoneSchema, toFullPhone, toLocalDigits } from '../validation';
import { t, lang } from '@/i18n';

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: { credential: string }) => void; ux_mode?: string }) => void;
      renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}
declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let scriptPromise: Promise<void> | null = null;
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SCRIPT_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scriptPromise = null;
      reject(new Error('google-script'));
    };
    document.head.appendChild(el);
  });
  return scriptPromise;
}

/** «Google orqali kirish / ro‘yxatdan o‘tish» tugmasi. GOOGLE client ID sozlanmagan yoki administrator paneli bo‘lsa ko‘rinmaydi. */
export function GoogleAuth() {
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLDivElement>(null);
  const isAdmin = useAuthStore((s) => s.preferredRole) === 'ADMIN' || env.appRole === 'ADMIN';
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [signup, setSignup] = useState<{ token: string; credential: string } | null>(null);
  const [phoneLocal, setPhoneLocal] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const configured = !!env.googleClientId;
  const enabled = configured && !isAdmin;

  useEffect(() => {
    if (!enabled || signup) return;
    let cancelled = false;
    void loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: env.googleClientId,
          callback: (response) => void onCredential(response.credential),
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'left',
          width: Math.min(360, Math.max(240, (buttonRef.current.parentElement?.clientWidth ?? 320))),
          locale: lang === 'uz-Cyrl' ? 'uz' : lang,
        });
      })
      .catch(() => setError(new Error(t('Google xizmatiga ulanib bo‘lmadi. Internetni tekshiring.'))));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, signup]);

  if (isAdmin) return null;
  if (!configured) {
    // Client ID hali kiritilmagan: tugma ko‘rinadi, bosilganda sozlash kerakligi aytiladi.
    return (
      <div className="gm-google">
        <div className="gm-google__divider" role="separator">
          <span>{t('yoki')}</span>
        </div>
        {!!error && <Alert tone="info">{getErrorMessage(error)}</Alert>}
        <button type="button" className="gm-google__fallback" onClick={() => setError(new Error(t('Google orqali kirish hali sozlanmagan. Administrator Google Client ID ni kiritishi kerak.')))}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7a14.500 14.500 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.600l7.9-6.100z"/><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.500-5.800c-2.100 1.400-4.800 2.300-8.400 2.300-6.300 0-11.600-4-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z"/></svg>
          {t('Google orqali davom etish')}
        </button>
      </div>
    );
  }

  async function onCredential(credential: string) {
    setError(null);
    setBusy(true);
    try {
      const result = await authService.googleSignIn(credential);
      if (result.needsPhone) {
        setSignup({ token: result.signupToken, credential });
        return;
      }
      useAuthStore.getState().setSession(true);
      const [firstItem] = getNavItems(useAuthStore.getState().preferredRole, { superAdmin: true });
      navigate(firstItem?.to ?? '/', { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function submitPhone() {
    if (!signup) return;
    const parsed = localPhoneSchema.safeParse(phoneLocal);
    const nextPhoneError = parsed.success ? null : (parsed.error.issues[0]?.message ?? t('Telefon raqami noto‘g‘ri'));
    const nextTermsError = accepted ? null : t('Davom etish uchun shartlarni qabul qiling');
    setPhoneError(nextPhoneError);
    setTermsError(nextTermsError);
    if (nextPhoneError || nextTermsError) return;
    setError(null);
    setBusy(true);
    try {
      const phone = toFullPhone(toLocalDigits(phoneLocal));
      const result = await authService.googleRegister(signup.token, phone);
      googlePending.set(signup.credential);
      const store = useAuthStore.getState();
      store.setPendingPhone(phone);
      store.setDevCode(result.developmentCode ?? null);
      store.setNewCredentials(null);
      navigate('/otp', { state: { flow: 'register', google: true } });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (signup) {
    return (
      <div className="gm-google gm-google--phone">
        <h2 className="gm-google__title">{t('Telefon raqamingizni kiriting')}</h2>
        <p className="gm-google__hint">{t('Google hisobingiz tasdiqlandi. Ro‘yxatdan o‘tishni yakunlash uchun telefon raqamingizga SMS-kod yuboramiz.')}</p>
        {!!error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
        <Input
          label={t('Telefon raqami')}
          prefix="+998"
          inputMode="numeric"
          placeholder="90 123 45 67"
          autoComplete="tel-national"
          maxLength={12}
          formatValue={formatLocalPhone}
          required
          value={phoneLocal}
          onChange={(event) => setPhoneLocal(event.target.value)}
          error={phoneError ?? undefined}
        />
        <Checkbox
          label={
            <>
              <Link to="/shartlar" target="_blank" rel="noopener" onClick={(event) => event.stopPropagation()}>
                {t('Foydalanish shartlari')}
              </Link>{' '}
              {t('ni o‘qib chiqdim va qabul qilaman')}
            </>
          }
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          error={termsError ?? undefined}
        />
        <Button type="button" fullWidth loading={busy} onClick={() => void submitPhone()}>
          {t('Kodni yuborish')}
        </Button>
        <Button type="button" variant="ghost" fullWidth onClick={() => setSignup(null)}>
          {t('Bekor qilish')}
        </Button>
      </div>
    );
  }

  return (
    <div className="gm-google">
      <div className="gm-google__divider" role="separator">
        <span>{t('yoki')}</span>
      </div>
      {!!error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
      <div className="gm-google__button" ref={buttonRef} aria-busy={busy} />
    </div>
  );
}
