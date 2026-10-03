import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { GoogleLogo } from './GoogleLogo';
import { loadGoogleScript } from '../google-script';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import { env } from '@/lib/env';
import { getErrorMessage } from '@/lib/error-messages';
import { getNavItems } from '@/components/layout/nav-items';
import { useAuthStore } from '@/store/auth.store';
import { authService } from '../services/auth.service';
import { formatLocalPhone, localPhoneSchema, toFullPhone, toLocalDigits } from '../validation';
import { t } from '@/i18n';

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
          width: Math.min(400, Math.max(200, buttonRef.current.parentElement?.clientWidth ?? 320)),
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
          <GoogleLogo />
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
      await authService.googleRegister(signup.token, phone);
      // Google orqali kirishda SMS-kod so‘ralmaydi: sessiya shu javobda ochilgan.
      useAuthStore.getState().setSession(true);
      setSignup(null);
      const [firstItem] = getNavItems(useAuthStore.getState().preferredRole, { superAdmin: true });
      navigate(firstItem?.to ?? '/', { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const phoneModal = (
    <Modal
      open={!!signup}
      onClose={() => setSignup(null)}
      title={t('Telefon raqamingizni kiriting')}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => setSignup(null)}>
            {t('Bekor qilish')}
          </Button>
          <Button type="button" loading={busy} onClick={() => void submitPhone()}>
            {t('Davom etish')}
          </Button>
        </>
      }
    >
      <div className="gm-google gm-google--phone">
        <p className="gm-google__hint">{t('Google hisobingiz tasdiqlandi. Ro‘yxatdan o‘tishni yakunlash uchun telefon raqamingizni kiriting.')}</p>
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
      </div>
    </Modal>
  );

  return (
    <div className="gm-google">
      <div className="gm-google__divider" role="separator">
        <span>{t('yoki')}</span>
      </div>
      {!!error && <Alert tone="danger">{getErrorMessage(error)}</Alert>}
      {phoneModal}
      <div className="gm-google__wrap">
        <span className="gm-google__fallback" aria-hidden="true">
          <GoogleLogo />
          {t('Google orqali davom etish')}
        </span>
        <div className="gm-google__button" ref={buttonRef} aria-busy={busy} aria-label={t('Google orqali davom etish')} />
      </div>
    </div>
  );
}
