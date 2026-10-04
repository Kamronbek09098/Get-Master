import { useCallback, useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { BadgeCheck, Check, Hammer, Wrench, Zap } from 'lucide-react';
import { t } from '@/i18n';
import { useIsStatic, useSceneProgress } from './JourneyContext';

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const group = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Sahna skroliga qarab 0 dan `to` gacha sanaydi (DOM to‘g‘ridan-to‘g‘ri yangilanadi). */
export function CountUp({ to, decimals = 0, suffix = '' }: { to: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isStatic = useIsStatic();
  const fmt = useCallback((v: number) => (decimals ? v.toFixed(decimals) : group(v)) + suffix, [decimals, suffix]);
  const apply = useCallback(
    (sp: number) => {
      if (ref.current) ref.current.textContent = fmt(to * easeOut(clamp((sp - 0.12) / 0.6)));
    },
    [fmt, to],
  );
  useSceneProgress(apply);
  return <span ref={ref}>{fmt(isStatic ? to : 0)}</span>;
}

export function Verified({ label = t('Tasdiqlangan') }: { label?: string }) {
  return (
    <span className="gm-j-verified">
      <BadgeCheck size={14} strokeWidth={2.4} aria-hidden="true" /> {label}
    </span>
  );
}

export function Monogram({ name, tone = 0 }: { name: string; tone?: number }) {
  return (
    <span className="gm-j-mono" style={{ '--tone': tone } as CSSProperties} aria-hidden="true">
      {name.slice(0, 1)}
    </span>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="gm-j-stars" aria-label={`${value} / 5`}>
      <span aria-hidden="true">★</span> {value.toFixed(1)}
    </span>
  );
}

/** Sahna faol bo‘lgandagina yuklanadi va ijro etiladi. Fayl bo‘lmasa (yoki yuklanmasa) video ko‘rinmaydi — ostidagi zaxira qoladi. */
export function FilmFrame({ active, base, poster, children }: { active: boolean; base: string; poster?: string; children?: ReactNode }) {
  const ref = useRef<HTMLVideoElement>(null);
  const isStatic = useIsStatic();
  useEffect(() => {
    const video = ref.current;
    if (!video || isStatic) return;
    if (active) {
      if (!video.getAttribute('src')) {
        const mobile = window.matchMedia('(max-width: 820px)').matches;
        video.src = `${base}${mobile ? '-m' : ''}.mp4`;
      }
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [active, isStatic, base]);
  return (
    <div className="gm-j-film">
      {children}
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        poster={poster}
        aria-hidden="true"
        tabIndex={-1}
        data-poster={poster ? '' : undefined}
        onLoadedData={(event) => event.currentTarget.classList.add('is-ready')}
      />
    </div>
  );
}

/** Usta ish joyida: haqiqiy kadr kelguncha — asboblar illyustratsiyasi (soxta foto emas). */
export function ToolsArt() {
  return (
    <div className="gm-j-tools" aria-hidden="true">
      <Wrench className="gm-j-tools__a" strokeWidth={1.1} />
      <Hammer className="gm-j-tools__b" strokeWidth={1.1} />
      <Zap className="gm-j-tools__c" strokeWidth={1.1} />
    </div>
  );
}

export interface TrackStep {
  label: string;
  note: string;
}

export function JobTrack({ steps, eta }: { steps: TrackStep[]; eta: string }) {
  return (
    <div className="gm-j-card gm-j-track" style={{ '--n': steps.length } as CSSProperties}>
      <div className="gm-j-track__head">
        <span className="gm-j-live">{t('Jonli')}</span>
        <span className="gm-j-track__eta">{eta}</span>
      </div>
      <ol>
        {steps.map((step, i) => (
          <li key={step.label} style={{ '--i': i } as CSSProperties}>
            <span className="gm-j-track__dot">
              <Check size={12} strokeWidth={3} aria-hidden="true" />
            </span>
            <span className="gm-j-track__text">
              <strong>{step.label}</strong>
              <small>{step.note}</small>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Oldin / Keyin: sudrash (sichqoncha, sensor) yoki klaviatura (← →) bilan. */
export function BeforeAfter({ caption }: { caption: string }) {
  const box = useRef<HTMLDivElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const touched = useRef(false);
  const dragging = useRef(false);

  const setPos = useCallback((value: number) => {
    const v = Math.min(100, Math.max(0, value));
    box.current?.style.setProperty('--pos', `${v.toFixed(1)}%`);
    if (range.current) range.current.value = String(Math.round(v));
  }, []);

  const auto = useCallback(
    (sp: number) => {
      if (!touched.current) setPos(14 + easeOut(clamp(sp / 0.9)) * 52);
    },
    [setPos],
  );
  useSceneProgress(auto);

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    touched.current = true;
    setPos(((event.clientX - rect.left) / rect.width) * 100);
  };

  return (
    <div className="gm-j-card gm-j-ba-wrap">
      <div
        ref={box}
        className="gm-j-ba"
        data-cursor="drag"
        style={{ '--pos': '50%' } as CSSProperties}
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          move(event);
        }}
        onPointerMove={(event) => dragging.current && move(event)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <div className="gm-j-ba__pane gm-j-ba__pane--after">
          <PipeArt fixed />
          <span className="gm-j-ba__tag">{t('Keyin')}</span>
        </div>
        <div className="gm-j-ba__pane gm-j-ba__pane--before">
          <PipeArt fixed={false} />
          <span className="gm-j-ba__tag">{t('Oldin')}</span>
        </div>
        <div className="gm-j-ba__handle" aria-hidden="true">
          <span>{t('Surish')}</span>
        </div>
        <input
          ref={range}
          className="gm-j-ba__range"
          type="range"
          min={0}
          max={100}
          defaultValue={50}
          aria-label={t('Oldin va keyin taqqoslash')}
          onChange={(event) => {
            touched.current = true;
            setPos(Number(event.currentTarget.value));
          }}
        />
      </div>
      <p className="gm-j-ba__caption">{caption}</p>
    </div>
  );
}

/** Oldin/keyin uchun vektor illyustratsiya: yorilgan quvur → tuzatilgan quvur. */
function PipeArt({ fixed }: { fixed: boolean }) {
  return (
    <svg viewBox="0 0 800 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="800" height="520" fill={fixed ? '#102a2a' : '#1d1620'} />
      <rect y="400" width="800" height="120" fill={fixed ? '#0c2220' : '#150f18'} />
      <g opacity=".08" stroke="#fff">
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} x1={i * 100} y1="0" x2={i * 100} y2="400" />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <line key={i} x1="0" y1={i * 100} x2="800" y2={i * 100} />
        ))}
      </g>
      <rect x="-10" y="215" width="820" height="54" rx="10" fill={fixed ? '#7fb9b0' : '#8a7f86'} />
      <rect x="-10" y="222" width="820" height="12" rx="6" fill="#fff" opacity=".22" />
      <rect x="330" y="205" width="80" height="74" rx="8" fill={fixed ? '#d6e4e1' : '#5b5058'} />
      <rect x="326" y="200" width="88" height="14" rx="5" fill={fixed ? '#f0b84b' : '#4a4047'} />
      <rect x="326" y="270" width="88" height="14" rx="5" fill={fixed ? '#f0b84b' : '#4a4047'} />
      {fixed ? (
        <>
          <circle cx="400" cy="400" r="46" fill="#49d5a3" opacity=".16" />
          <circle cx="400" cy="400" r="30" fill="#49d5a3" />
          <path d="M386 400l10 10 19-21" stroke="#04231a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      ) : (
        <>
          <path d="M372 269l14 22-10 12 16 20" stroke="#ff6b78" strokeWidth="4" fill="none" strokeLinecap="round" />
          {[0, 1, 2].map((i) => (
            <ellipse key={i} cx={384 + i * 12} cy={330 + i * 26} rx="5" ry="8" fill="#6aa8ff" className="gm-j-drip" style={{ animationDelay: `${i * 0.35}s` }} />
          ))}
          <ellipse cx="400" cy="450" rx="120" ry="20" fill="#6aa8ff" opacity=".28" />
          <ellipse cx="400" cy="450" rx="70" ry="10" fill="#6aa8ff" opacity=".3" />
        </>
      )}
    </svg>
  );
}
