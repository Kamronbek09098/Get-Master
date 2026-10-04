import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { prefersReducedMotion } from '@/lib/motion/tokens';
import { t } from '@/i18n';
import { magneticHandlers } from '../fx/interactions';
import { JourneyContext, type JourneyBus } from './JourneyContext';
import { CUSTOMER_SCENES, JOURNEY_COPY, MASTER_SCENES, type JourneyRole } from './journey-content';
import { VISUALS } from './visuals';
import './journey.css';

/**
 * Skroll — rejissyor. Pinned (sticky) sahna: skroll foizi → faol sahna (index) + sahna ichidagi foiz (`--sp`).
 * React faqat sahna almashganda qayta chiziladi; sahna ichidagi harakat CSS o‘zgaruvchisi orqali.
 * Harakat kamaytirilgan bo‘lsa: pin yo‘q, barcha sahnalar ketma-ket va yakuniy holatda.
 */
export function Journey({ role }: { role: JourneyRole }) {
  const scenes = role === 'master' ? MASTER_SCENES : CUSTOMER_SCENES;
  const copy = JOURNEY_COPY[role];
  const visuals = VISUALS[role];
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [isStatic] = useState(prefersReducedMotion);
  const finalRef = useRef<HTMLElement>(null);
  const [finalIn, setFinalIn] = useState(false);
  const listeners = useRef(new Set<(sp: number) => void>());

  const bus = useMemo<JourneyBus>(
    () => ({
      isStatic,
      subscribe: (listener) => {
        listeners.current.add(listener);
        return () => void listeners.current.delete(listener);
      },
    }),
    [isStatic],
  );

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage || isStatic) return;
    const n = scenes.length;
    let current = -1;
    let frame = 0;
    // Pozitsiya har safar jonli o‘lchanadi: yuqoridagi lazy bo‘limlar balandligi o‘zgarsa ham aniq qoladi.
    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const range = rect.height - window.innerHeight;
      if (range <= 0) return;
      const progress = Math.min(1, Math.max(0, -rect.top / range));
      const raw = progress * n;
      const index = Math.min(n - 1, Math.floor(raw));
      const sp = Math.min(1, raw - index);
      stage.style.setProperty('--sp', sp.toFixed(4));
      stage.style.setProperty('--p', progress.toFixed(4));
      if (index !== current) {
        current = index;
        setActive(index);
      }
      listeners.current.forEach((fn) => fn(sp));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [isStatic, scenes.length]);

  // Yakuniy blok o‘zining kuzatuvchisiga ega: Journey lazy yuklangani uchun sahifa darajasidagi data-reveal uni ko‘rmaydi.
  useEffect(() => {
    const node = finalRef.current;
    if (!node) return;
    if (isStatic || typeof IntersectionObserver === 'undefined') {
      setFinalIn(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setFinalIn(true);
        observer.disconnect();
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isStatic]);

  const goTo = (index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    if (isStatic) {
      section.querySelectorAll('[data-scene]')[index]?.scrollIntoView();
      return;
    }
    const range = section.offsetHeight - window.innerHeight;
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + ((index + 0.35) / scenes.length) * range, behavior: 'smooth' });
  };

  const onRailKey = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowRight' && event.key !== 'ArrowUp' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const dir = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
    const next = Math.min(scenes.length - 1, Math.max(0, active + dir));
    goTo(next);
    (event.currentTarget.querySelectorAll('button')[next] as HTMLElement | undefined)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, scenes.length, isStatic]);

  return (
    <JourneyContext.Provider value={bus}>
      <section
        ref={sectionRef}
        className={`gm-j gm-j--${role}${isStatic ? ' gm-j--static' : ''}`}
        id="qanday"
        aria-labelledby="gm-j-title"
        style={{ '--n': scenes.length } as CSSProperties}
      >
        <h2 id="gm-j-title" className="gm-j__sr">
          {copy.label}
        </h2>
        <div className="gm-j__stage" ref={stageRef}>
          <div className="gm-j__scenes">
            {scenes.map((scene, index) => {
              const Visual = visuals[scene.id];
              const on = isStatic || index === active;
              return (
                <article key={scene.id} data-scene className={on ? 'gm-j-scene is-active' : 'gm-j-scene'} aria-hidden={on ? undefined : true}>
                  <div className="gm-j-scene__text">
                    <p className="gm-j-scene__kicker">
                      <span>{String(index + 1).padStart(2, '0')}</span> {scene.kicker}
                    </p>
                    <h3>{scene.title}</h3>
                    <p>{scene.text}</p>
                  </div>
                  <div className="gm-j-scene__visual" aria-hidden={scene.id === 'result' ? undefined : true}>
                    {Visual && <Visual active={on} />}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="gm-j__rail" role="group" aria-label={copy.label} onKeyDown={onRailKey}>
            <span className="gm-j__label">{copy.label}</span>
            <div className="gm-j__dots">
              {scenes.map((scene, index) => (
                <button
                  key={scene.id}
                  type="button"
                  className={index === active ? 'is-active' : index < active ? 'is-done' : undefined}
                  aria-label={`${index + 1}. ${scene.kicker}`}
                  aria-current={index === active ? 'step' : undefined}
                  onClick={() => goTo(index)}
                />
              ))}
            </div>
            <span className="gm-j__count" aria-hidden="true">
              {String(active + 1).padStart(2, '0')} / {String(scenes.length).padStart(2, '0')}
            </span>
            <Link to="/register" className="gm-j__rail-cta">
              {copy.cta} <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section ref={finalRef} className={`gm-j-final${finalIn ? ' is-in' : ''}${isStatic ? ' is-static' : ''}`}>
        <h2>
          {copy.tagline.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h2>
        <Link to="/register" className="gm-j-final__cta" {...magneticHandlers}>
          {copy.cta} <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <p>{t('Ro‘yxatdan o‘tish bir daqiqa oladi va bepul.')}</p>
      </section>
    </JourneyContext.Provider>
  );
}
