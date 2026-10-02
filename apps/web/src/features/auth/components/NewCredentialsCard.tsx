import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/auth.store';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="gm-cred-card__copy"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? <Check size={16} /> : <Copy size={16} />} {done ? 'Nusxalandi' : 'Nusxalash'}
    </button>
  );
}

/**
 * Ro‘yxatdan o‘tishdan keyin login va parol faqat BIR MARTA ko‘rsatiladi. Parol serverda faqat xesh ko‘rinishida
 * saqlanadi (hech kim, administrator ham ko‘ra olmaydi va tiklab bo‘lmaydi); shu sabab uni o‘zingiz saqlab qo‘yishingiz kerak.
 * Kartochka yopilganda parol xotiradan o‘chiriladi.
 */
export function NewCredentialsCard({ onContinue }: { onContinue: () => void }) {
  const credentials = useAuthStore((s) => s.newCredentials);
  const setNewCredentials = useAuthStore((s) => s.setNewCredentials);
  const [shown, setShown] = useState(true);
  const [saved, setSaved] = useState(false);
  const clearTimer = useRef(0);

  // Haqiqiy yopilishda xotiradan o‘chiriladi. StrictMode'ning sinov (mount→unmount→mount) siklida o‘chirib yubormaslik uchun kechiktirilgan va qayta mount bo‘lsa bekor qilinadi.
  useEffect(() => {
    if (clearTimer.current) window.clearTimeout(clearTimer.current);
    return () => {
      clearTimer.current = window.setTimeout(() => setNewCredentials(null), 0);
    };
  }, [setNewCredentials]);

  if (!credentials) return null;

  return (
    <div className="gm-cred-card">
      <div className="gm-cred-card__head">
        <span className="gm-cred-card__icon" aria-hidden="true">
          <KeyRound size={22} />
        </span>
        <div>
          <h2>Hisobingiz yaratildi</h2>
          <p>Kirish uchun login va parolingiz</p>
        </div>
      </div>

      <div className="gm-cred-card__rows">
        <div className="gm-cred-card__row">
          <span className="gm-cred-card__label">Login (telefon)</span>
          <strong className="gm-cred-card__value">{credentials.phone}</strong>
          <CopyButton text={credentials.phone} label="Loginni nusxalash" />
        </div>
        <div className="gm-cred-card__row">
          <span className="gm-cred-card__label">Parol</span>
          <strong className="gm-cred-card__value gm-cred-card__value--mono">{shown ? credentials.password : '•'.repeat(Math.min(credentials.password.length, 14))}</strong>
          <span className="gm-cred-card__tools">
            <button type="button" className="gm-cred-card__copy" onClick={() => setShown((value) => !value)} aria-label={shown ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}>
              {shown ? <EyeOff size={16} /> : <Eye size={16} />} {shown ? 'Yashirish' : 'Ko‘rsatish'}
            </button>
            <CopyButton text={credentials.password} label="Parolni nusxalash" />
          </span>
        </div>
      </div>

      <div className="gm-cred-card__warn" role="alert">
        <ShieldAlert size={18} aria-hidden="true" />
        <p>
          <strong>Login va parolni o‘zingiz uchun saqlab qo‘ying.</strong> Ular faqat hozir, bir marta ko‘rsatiladi. Parol xavfsizlik uchun xeshlangan holda saqlanadi —
          uni hech kim, administrator ham ko‘ra olmaydi va tiklab bo‘lmaydi.
        </p>
      </div>

      <label className="gm-cred-card__confirm">
        <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
        Login va parolni saqlab oldim
      </label>

      <Button fullWidth className="gm-auth-submit" disabled={!saved} onClick={onContinue}>
        Kirishga o‘tish
      </Button>
    </div>
  );
}
