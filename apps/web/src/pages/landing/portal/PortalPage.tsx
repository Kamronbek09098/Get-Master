import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import { ArrowRight, ArrowUpRight, BadgeCheck, Camera, ChevronDown, ClipboardCheck, Handshake, Search, ShieldCheck, Star, TrendingUp, UserRound, Wallet, Wrench } from 'lucide-react';
import { LogoLink } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { env } from '@/lib/env';
import { t } from '@/i18n';
import { useSmoothScroll } from '../fx/useSmoothScroll';
import { ServiceBelt } from '../fx/ServiceBelt';
import './portal.css';


const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Elementning skroll jarayonini 0..1 oralig‘ida `--p` CSS o‘zgaruvchisi sifatida yozadi.
 * `pin` — yopishqoq (sticky) bo‘lim: bo‘lim balandligi bo‘ylab; `pass` — ko‘rinish maydonidan o‘tishi bo‘ylab; `leave` — ekrandan chiqib ketishi bo‘ylab (tepadan 0 dan boshlanadi); `read` — matn ekranning pastidan kirib, o‘rtasiga yetganda 1 ga to‘ladi (o‘qib bo‘lguncha).
 */
function useScrollProgress<T extends HTMLElement>(mode: 'pin' | 'pass' | 'leave' | 'read', onChange?: (p: number) => void): RefObject<T> {
  const ref = useRef<T>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = mode === 'pin' ? clamp(-rect.top / Math.max(1, rect.height - vh)) : mode === 'leave' ? clamp(-rect.top / Math.max(1, rect.height)) : mode === 'read' ? clamp((vh * 0.9 - rect.top) / Math.max(1, rect.height + vh * 0.3)) : clamp((vh - rect.top) / (vh + rect.height));
      node.style.setProperty('--p', p.toFixed(4));
      callback.current?.(p);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [mode]);
  return ref;
}

/** Ko‘rinishga kirgan `[data-reveal]` elementlarni ketma-ket ochadi. */
function useReveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.gm-portal [data-reveal]'));
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((node) => node.classList.add('is-in'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -6% 0px' },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

/** Karta ustida sichqoncha yo‘lini kuzatuvchi yorug‘lik (spotlight). */
const spotlight = (event: ReactPointerEvent<HTMLElement>) => {
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty('--mx', `${event.clientX - rect.left}px`);
  event.currentTarget.style.setProperty('--my', `${event.clientY - rect.top}px`);
};

const AUDIENCES = [
  {
    key: 'customer',
    href: () => env.customerUrl,
    icon: UserRound,
    kicker: () => t('Mijoz uchun'),
    title: () => t('Men mijozman'),
    text: () => t('Muammoni tasvirlab, mos ustani topaman'),
    cta: () => t('Mijoz saytiga o‘tish'),
  },
  {
    key: 'master',
    href: () => env.masterUrl,
    icon: Wrench,
    kicker: () => t('Usta uchun'),
    title: () => t('Men ustaman'),
    text: () => t('Buyurtmalar olaman va daromad topaman'),
    cta: () => t('Usta saytiga o‘tish'),
  },
] as const;

function AudienceCard({ audience, index }: { audience: (typeof AUDIENCES)[number]; index: number }) {
  return (
    <a href={audience.href()} className={`gm-portal__door gm-portal__door--${audience.key}`} onPointerMove={spotlight} style={{ ['--i' as string]: index } as CSSProperties}>
      <span className="gm-portal__door-glow" aria-hidden="true" />
      <span className="gm-portal__door-icon">
        <audience.icon size={26} strokeWidth={1.9} />
      </span>
      <span className="gm-portal__door-body">
        <small>{audience.kicker()}</small>
        <strong>{audience.title()}</strong>
        <span>{audience.text()}</span>
      </span>
      <span className="gm-portal__door-go" aria-hidden="true">
        <ArrowRight size={20} />
      </span>
    </a>
  );
}

/** Faylning haqiqatan mavjudligini tekshiradi (dev serverda mavjud bo‘lmagan fayl uchun index.html qaytadi, shuning uchun turi ham tekshiriladi). */
async function exists(url: string, kind: 'image' | 'video'): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok && (response.headers.get('content-type') ?? '').startsWith(`${kind}/`);
  } catch {
    return false;
  }
}

const HERO_DIR = '/media/hero';
const FALLBACK = '/media/stories/santexnika';

/** Hero foni: `public/media/hero/portal.jpg|mp4` (maxsus tayyorlangan) bo‘lsa shu, bo‘lmasa loyihaning uy sahnasi videosi. Harakat kamaytirilgan bo‘lsa — faqat surat. */
function HeroMedia() {
  const ref = useRef<HTMLVideoElement>(null);
  const [custom, setCustom] = useState<{ video: boolean; image: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all([exists(`${HERO_DIR}/portal.mp4`, 'video'), exists(`${HERO_DIR}/portal.jpg`, 'image')]).then(([video, image]) => {
      if (alive) setCustom({ video, image });
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const video = ref.current;
    if (video && window.matchMedia('(prefers-reduced-motion: reduce)').matches) video.pause();
  }, [custom]);

  if (!custom) return <img className="gm-portal__hero-media" src={`${FALLBACK}/film.jpg`} alt="" aria-hidden="true" draggable={false} />;
  if (custom.image && !custom.video) return <img className="gm-portal__hero-media" src={`${HERO_DIR}/portal.jpg`} alt="" aria-hidden="true" draggable={false} />;
  if (custom.video) {
    return (
      <video ref={ref} className="gm-portal__hero-media" autoPlay muted loop playsInline preload="auto" poster={custom.image ? `${HERO_DIR}/portal.jpg` : undefined} aria-hidden="true" tabIndex={-1}>
        <source src={`${HERO_DIR}/portal-m.mp4`} type="video/mp4" media="(max-width: 720px)" />
        <source src={`${HERO_DIR}/portal.mp4`} type="video/mp4" />
      </video>
    );
  }
  return (
    <video ref={ref} className="gm-portal__hero-media" autoPlay muted loop playsInline preload="auto" poster={`${FALLBACK}/film.jpg`} aria-hidden="true" tabIndex={-1}>
      <source src={`${FALLBACK}/film-m.mp4`} type="video/mp4" media="(max-width: 720px)" />
      <source src={`${FALLBACK}/film.mp4`} type="video/mp4" />
    </video>
  );
}

function Hero() {
  const ref = useScrollProgress<HTMLElement>('leave');
  const words = [t('Uy xizmatlari'), t('Bir joyda')];
  return (
    <header className="gm-portal__hero" ref={ref}>
      <HeroMedia />
      <div className="gm-portal__hero-shade" aria-hidden="true" />
      <nav className="gm-portal__nav" aria-label={t('Bo‘limlar')}>
        <LogoLink className="gm-portal__logo" />
        <div className="gm-portal__nav-end">
          <div className="gm-portal__nav-links">
            <a href="#qanday">{t('Qanday ishlaydi')}</a>
            <a href="#ikki-tomon">{t('Mijoz va usta')}</a>
            <a href="#ishonch-bolim">{t('Ishonch')}</a>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <div className="gm-portal__hero-inner">
        <p className="gm-portal__eyebrow">
          <i aria-hidden="true" /> GetMaster
        </p>
        <h1 aria-label={words.join(' ')}>
          {words.map((line, lineIndex) => (
            <span key={line} className="gm-portal__line" aria-hidden="true">
              {line.split(' ').map((word, index) => (
                <span key={`${word}-${index}`} className="gm-portal__word" style={{ ['--i' as string]: lineIndex * 3 + index } as CSSProperties}>
                  {word}
                </span>
              ))}
            </span>
          ))}
        </h1>
        <p className="gm-portal__lead">
          <span>{t('Tasdiqlangan ustalar, aniq narx va kafolat — hammasi bir joyda')}</span>
          <span>{t('Davom etish uchun rolingizni tanlang.')}</span>
        </p>
        <div className="gm-portal__doors">
          {AUDIENCES.map((audience, index) => (
            <AudienceCard key={audience.key} audience={audience} index={index} />
          ))}
        </div>
      </div>
      <a href="#qanday" className="gm-portal__cue" aria-label={t('Pastga')}>
        <span>{t('Pastga')}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </a>
    </header>
  );
}

const STATEMENT = t('Har kuni biror narsa buziladi. Biz muammoni hal qiladigan tasdiqlangan ustani — narxi aniq, ishi kafolatli — daqiqalar ichida topib beramiz. Ustalar esa mijoz izlamaydi: so‘rovlar o‘zi keladi.');

function Statement() {
  const ref = useScrollProgress<HTMLElement>('read');
  const words = STATEMENT.split(' ');
  return (
    <section className="gm-portal__statement" ref={ref} aria-label={STATEMENT}>
      <p aria-hidden="true" style={{ ['--n' as string]: words.length } as CSSProperties}>
        {words.map((word, index) => (
          <span key={`${word}-${index}`} style={{ ['--i' as string]: index } as CSSProperties}>
            {word}{' '}
          </span>
        ))}
      </p>
    </section>
  );
}

const STEPS: Array<{ icon: typeof Search; title: () => string; text: () => string; hint: () => string }> = [
  { icon: Search, title: () => t('Muammoni ayting'), text: () => t('Mijoz muammoni matn, foto, video yoki ovoz bilan tasvirlaydi. Mos ustalar so‘rovni ko‘radi.'), hint: () => t('Mijoz') },
  { icon: Handshake, title: () => t('Taklif va tanlov'), text: () => t('Ustalar narx va vaqt bilan taklif yuboradi. Mijoz reyting va sharhlarga qarab eng yaxshisini tanlaydi.'), hint: () => t('Mijoz va usta') },
  { icon: ShieldCheck, title: () => t('Ish, isbot va kafolat'), text: () => t('Usta ish oldidan va keyin suratga oladi. Mijoz tasdiqlagach to‘lov o‘tadi va kafolat boshlanadi.'), hint: () => t('Mijoz va usta') },
];

function HowItWorks() {
  const [active, setActive] = useState(0);
  const ref = useScrollProgress<HTMLElement>('pin', (p) => setActive(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length))));
  return (
    <section className="gm-portal__how" id="qanday" ref={ref}>
      <div className="gm-portal__how-sticky">
        <div className="gm-portal__how-head">
          <p className="gm-portal__kicker">{t('Qanday ishlaydi')}</p>
          <h2>{t('Uch qadamda hal bo‘ladi')}</h2>
          <div className="gm-portal__how-rail" aria-hidden="true">
            <i />
          </div>
        </div>
        <ol className="gm-portal__how-list">
          {STEPS.map((step, index) => (
            <li key={index} className={index === active ? 'is-active' : index < active ? 'is-done' : undefined}>
              <span className="gm-portal__how-num">0{index + 1}</span>
              <span className="gm-portal__how-icon" aria-hidden="true">
                <step.icon size={26} strokeWidth={1.8} />
              </span>
              <div>
                <h3>{step.title()}</h3>
                <p>{step.text()}</p>
                <small>{step.hint()}</small>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const SIDES = [
  {
    key: 'customer',
    kicker: () => t('Mijozlar uchun'),
    title: () => t('Muammoni ayting — ustani biz topamiz'),
    items: () => [t('Matn, foto, video yoki ovoz bilan so‘rov'), t('Bir nechta ustadan narx taklifi'), t('Ish isboti va kafolat'), t('Xavfsiz onlayn to‘lov')],
    href: () => env.customerUrl,
    cta: () => t('Mijoz saytiga o‘tish'),
    icon: UserRound,
  },
  {
    key: 'master',
    kicker: () => t('Ustalar uchun'),
    title: () => t('Mijoz izlamang — ular sizni topadi'),
    items: () => [t('Yaqin atrofdagi so‘rovlar o‘zi keladi'), t('Narxni o‘zingiz belgilaysiz'), t('Shaffof daromad va to‘lovlar'), t('Reyting va portfolio'),],
    href: () => env.masterUrl,
    cta: () => t('Usta saytiga o‘tish'),
    icon: Wrench,
  },
] as const;

function Sides() {
  return (
    <section className="gm-portal__sides" id="ikki-tomon">
      <div className="gm-portal__section-head" data-reveal>
        <p className="gm-portal__kicker">{t('Ikki tomon — bitta platforma')}</p>
        <h2>{t('Kim sifatida davom etasiz?')}</h2>
      </div>
      <div className="gm-portal__sides-grid">
        {SIDES.map((side, index) => (
          <article key={side.key} className={`gm-portal__side gm-portal__side--${side.key}`} data-reveal style={{ ['--i' as string]: index } as CSSProperties} onPointerMove={spotlight}>
            <span className="gm-portal__door-glow" aria-hidden="true" />
            <div className="gm-portal__side-top">
              <span className="gm-portal__side-icon">
                <side.icon size={28} strokeWidth={1.8} />
              </span>
              <p className="gm-portal__kicker">{side.kicker()}</p>
            </div>
            <h3>{side.title()}</h3>
            <ul>
              {side.items().map((item) => (
                <li key={item}>
                  <BadgeCheck size={18} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <a href={side.href()} className="gm-portal__btn gm-portal__btn--wide">
              {side.cta()} <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

const FACTS: Array<{ value: () => string; label: () => string }> = [
  { value: () => '24/7', label: () => t('So‘rov qabul qilish') },
  { value: () => '100%', label: () => t('Tasdiqlangan ustalar') },
  { value: () => t('Kafolat'), label: () => t('Har bir ishga') },
  { value: () => t('Xavfsiz'), label: () => t('Onlayn to‘lov') },
];

const TRUST: Array<{ icon: typeof Camera; title: () => string; text: () => string }> = [
  { icon: BadgeCheck, title: () => t('Tasdiqlangan ustalar'), text: () => t('Har bir usta shaxsini tasdiqlovchi hujjat bilan tekshiriladi.') },
  { icon: Camera, title: () => t('Ish isboti'), text: () => t('Oldin va keyin suratlar — nizo chiqsa, dalil tayyor.') },
  { icon: Star, title: () => t('Haqiqiy sharhlar'), text: () => t('Faqat ish tugagandan keyin haqiqiy mijoz baho qoldira oladi.') },
  { icon: Wallet, title: () => t('Himoyalangan to‘lov'), text: () => t('Pul platforma orqali o‘tadi — ish tugagach kafolatli.') },
  { icon: TrendingUp, title: () => t('Doimiy buyurtmalar'), text: () => t('Ustalar uchun mijozlar oqimi tayyor, izlash shart emas.') },
  { icon: ClipboardCheck, title: () => t('Shaffoflik'), text: () => t('Narx, muddat va holat har doim ko‘rinib turadi.') },
];

const TONES = ['blue', 'green', 'amber', 'violet', 'blue', 'green'] as const;

function Trust(): ReactNode {
  return (
    <section className="gm-portal__trust" id="ishonch-bolim">
      <div className="gm-portal__facts">
        {FACTS.map((fact, index) => (
          <div key={index} data-reveal style={{ ['--i' as string]: index } as CSSProperties}>
            <strong>{fact.value()}</strong>
            <span>{fact.label()}</span>
          </div>
        ))}
      </div>
      <div className="gm-portal__section-head" data-reveal>
        <p className="gm-portal__kicker">{t('Ishonch')}</p>
        <h2>{t('Nega GetMaster ishonchli')}</h2>
      </div>
      <div className="gm-portal__trust-grid">
        {TRUST.map((item, index) => (
          <div key={index} className="gm-portal__card" data-tone={TONES[index % TONES.length]} data-reveal style={{ ['--i' as string]: index % 3 } as CSSProperties} onPointerMove={spotlight}>
            <span className="gm-portal__door-glow" aria-hidden="true" />
            <span className="gm-portal__card-icon">
              <item.icon size={22} strokeWidth={1.9} />
            </span>
            <span className="gm-portal__card-no" aria-hidden="true">0{index + 1}</span>
            <h3>{item.title()}</h3>
            <p>{item.text()}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Finale() {
  const ref = useScrollProgress<HTMLElement>('pass');
  return (
    <section className="gm-portal__finale" ref={ref}>
      <div className="gm-portal__finale-inner">
        <h2 data-reveal>{t('Boshlaymizmi?')}</h2>
        <p data-reveal>{t('Ro‘yxatdan o‘tish bir daqiqa oladi va bepul.')}</p>
        <div className="gm-portal__finale-actions" data-reveal>
          <a href={env.customerUrl} className="gm-portal__btn gm-portal__btn--customer">
            <UserRound size={18} aria-hidden="true" /> {t('Men mijozman')} <ArrowRight size={18} aria-hidden="true" />
          </a>
          <a href={env.masterUrl} className="gm-portal__btn gm-portal__btn--master">
            <Wrench size={18} aria-hidden="true" /> {t('Men ustaman')} <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
      </div>
      <footer className="gm-portal__footer">
        <LogoLink />
        <p>{t('© {getFullYear} GetMaster. Barcha huquqlar himoyalangan.', { getFullYear: new Date().getFullYear() })}</p>
        <a href="/shartlar">{t('Foydalanish shartlari')}</a>
      </footer>
    </section>
  );
}

/** Asosiy sayt (getmaster.uz): faqat yo‘naltiradi — mijoz saytiga yoki usta saytiga. Skroll bilan ishlaydigan taqdimot. */
export function PortalPage() {
  useSmoothScroll();
  useReveal();
  return (
    <div className="gm-portal">
      <div id="gm-scroll-progress" className="gm-scroll-progress" aria-hidden="true" />
      <Hero />
      <ServiceBelt />
      <Statement />
      <HowItWorks />
      <Sides />
      <Trust />
      <Finale />
    </div>
  );
}
