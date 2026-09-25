import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import type { AlertTone } from '@/components/ui/Alert';
import { useMyMasterProfile } from '@/features/master/hooks/useMaster';
import type { MasterVerificationStatus } from '@/features/master/types';

type Unverified = Exclude<MasterVerificationStatus, 'VERIFIED'>;

const NOTICE: Record<Unverified, { tone: AlertTone; title: string; text: string; action: string | null }> = {
  PENDING: {
    tone: 'warning',
    title: 'Profilingiz hali tasdiqlanmagan',
    text: 'Buyurtma va so‘rovlar olishni boshlash uchun profilingizni tasdiqlatishingiz kerak: shaxsingizni tasdiqlovchi hujjatni yuboring. Tasdiqlanmaguncha profilni faollashtirib bo‘lmaydi.',
    action: 'Hujjat yuborish',
  },
  UNDER_REVIEW: {
    tone: 'info',
    title: 'Hujjatlaringiz ko‘rib chiqilmoqda',
    text: 'Administrator hujjatlaringizni tekshirmoqda. Natija bildirishnomalar bo‘limida ko‘rinadi. Tasdiqlanmaguncha profilni faollashtirib bo‘lmaydi.',
    action: null,
  },
  CORRECTION_REQUESTED: {
    tone: 'warning',
    title: 'Hujjatlarni tuzatish so‘ralgan',
    text: 'Administrator hujjatlaringizda kamchilik topdi. Sababini ko‘rib, to‘g‘irlangan hujjatni qayta yuboring.',
    action: 'Hujjatni qayta yuborish',
  },
  REJECTED: {
    tone: 'danger',
    title: 'Tasdiqlash rad etildi',
    text: 'Hujjatlaringiz qabul qilinmadi. Sababini ko‘rib, yangi hujjat yuborishingiz mumkin.',
    action: 'Hujjatni qayta yuborish',
  },
  EXPIRED: {
    tone: 'danger',
    title: 'Tasdiqlash muddati tugagan',
    text: 'Hujjatingiz muddati tugadi. Ishni davom ettirish uchun yangi hujjat yuboring.',
    action: 'Hujjat yuborish',
  },
};

export const FOCUS_VERIFICATION_EVENT = 'gm:focus-verification';
const PROFILE_PATH = '/ustalar/profil';

export function VerificationBanner() {
  const profile = useMyMasterProfile();
  const { pathname } = useLocation();
  const verification = profile.data?.verification;
  if (!verification || verification === 'VERIFIED') return null;

  const notice = NOTICE[verification];
  return (
    <div className="gm-verification-banner">
      <Alert tone={notice.tone} title={notice.title}>
        {notice.text}{' '}
        {notice.action && (
          <Link
            to={`${PROFILE_PATH}#tasdiqlash`}
            className="gm-verification-banner__link"
            onClick={(event) => {
              if (pathname !== PROFILE_PATH) return;
              event.preventDefault();
              window.dispatchEvent(new Event(FOCUS_VERIFICATION_EVENT));
            }}
          >
            {notice.action} <ArrowRight size={15} aria-hidden="true" />
          </Link>
        )}
      </Alert>
    </div>
  );
}
