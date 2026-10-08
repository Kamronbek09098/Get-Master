import { useState } from 'react';
import type { ReactNode } from 'react';
import { MapPin, MessageSquarePlus, Scale, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { isNativeApp } from '@/features/push/push-native';
import { t } from '@/i18n';
import './Onboarding.css';

const KEY = 'gm-onboarded';
const read = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
};

const SLIDES = [
  { icon: MapPin, tone: 'amber', title: () => t('Shahringizdagi usta'), text: () => t('Ustalarni qidiruv orqali toping, tizim sizga mos mutaxassislarni tanlab beradi. Filtr yordamida shahar va tumandagi ustalarni topasiz.') },
  { icon: MessageSquarePlus, tone: 'blue', title: () => t('Muammoni ayting'), text: () => t('Muammoni matn, foto, video yoki ovoz bilan tasvirlab bering. Mos ustalar so‘rovingizni ko‘radi.') },
  { icon: Scale, tone: 'green', title: () => t('Takliflarni solishtiring'), text: () => t('Ustalar narx va muddat bilan taklif yuboradi. Reyting va sharhlarga qarab eng yaxshisini tanlang.') },
  { icon: ShieldCheck, tone: 'violet', title: () => t('Xavfsiz to‘lov va kafolat'), text: () => t('Ish oldidan va keyingi surat isboti, kafolat va nizolarni hal qilish xizmati sizni himoya qiladi.') },
] as const;

/** Telefon ilovasi birinchi marta ochilganda: 4 bosqichli «Qanday ishlaydi?» tanishtiruvi. Brauzerda `?intro=1` bilan ko‘rsatish mumkin. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const forced = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('intro');
  const [done, setDone] = useState(() => !(forced || (isNativeApp() && !read())));
  const [index, setIndex] = useState(0);
  if (done) return <>{children}</>;

  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index]!;
  const Icon = slide.icon;
  function finish() {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* saqlab bo‘lmasa ham davom etadi */
    }
    setDone(true);
  }

  return (
    <div className="gm-onb" role="dialog" aria-modal="true" aria-label={t('Qanday ishlaydi?')}>
      <div className="gm-onb__bars" aria-hidden="true">
        {SLIDES.map((_, i) => (
          <span key={i} className={i <= index ? 'is-on' : undefined} />
        ))}
      </div>
      <button type="button" className="gm-onb__skip" onClick={finish}>{t('O‘tkazib yuborish')}</button>
      <h1 className="gm-onb__head">{t('Qanday ishlaydi?')}</h1>
      <div className="gm-onb__art" key={index}>
        <span className={`gm-onb__orb gm-onb__orb--${slide.tone}`}>
          <Icon size={84} strokeWidth={1.6} aria-hidden="true" />
        </span>
      </div>
      <div className="gm-onb__copy" key={`c${index}`} aria-live="polite">
        <h2>{slide.title()}</h2>
        <p>{slide.text()}</p>
      </div>
      <div className="gm-onb__foot">
        <Button size="lg" fullWidth onClick={() => (last ? finish() : setIndex(index + 1))}>
          {last ? t('Boshlash') : t('Keyingi')}
        </Button>
      </div>
    </div>
  );
}
