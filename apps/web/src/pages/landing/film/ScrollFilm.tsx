import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ScrollVideo } from '@/components/media/ScrollVideo';
import { getGsap } from '@/lib/motion/gsap';
import { prefersReducedMotion } from '@/lib/motion/tokens';
import { ShaderBackground } from '../fx/ShaderBackground';
import { createFilmStage, SCENES, type FilmStage } from './FilmStage';
import { SCENE_NAMES, filmLabels, filmScenes } from './film-content';
import { INPUT_METHODS, type LandingContent } from '../landing-content';
import './film.css';
import { t } from '@/i18n';

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Haqiqiy ish videosi (ixtiyoriy): /media/film/customer.mp4 yoki master.mp4 bo‘lsa, skroll bilan boshqariladi. */
function useFilmVideo(master: boolean) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const base = `/media/film/${master ? 'master' : 'customer'}`;
    fetch(`${base}.mp4`, { method: 'HEAD' })
      .then((res) => {
        const type = res.headers.get('content-type') ?? '';
        if (!cancelled) setAvailable(res.ok && type.startsWith('video/'));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [master]);
  return { available, base: `/media/film/${master ? 'master' : 'customer'}` };
}

/**
 * Bosh sahifaning kinematografik ochilishi: skroll — filmni boshqaradi.
 * Sticky sahna + GSAP ScrollTrigger progressi → (3D sahna, sarlavhalar, videoning currentTime) — React qayta chizilmasdan.
 */
export function ScrollFilm({ content, master }: { content: LandingContent; master: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [mode, setMode] = useState<'pending' | 'film' | 'static'>('pending');
  const video = useFilmVideo(master);
  const scenes = filmScenes(master);
  const names = SCENE_NAMES();

  useEffect(() => {
    setMode(webglAvailable() && !prefersReducedMotion() ? 'film' : 'static');
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const mount = stageRef.current;
    if (mode !== 'film' || !section || !mount) return;
    const { ScrollTrigger } = getGsap();
    const lowPower = window.matchMedia('(max-width: 700px)').matches || (navigator.hardwareConcurrency ?? 8) <= 4;
    const stage: FilmStage | null = createFilmStage(mount, filmLabels(master), { lowPower });
    if (!stage) {
      setMode('static');
      return;
    }
    const caps = Array.from(section.querySelectorAll<HTMLElement>('[data-cap]'));
    const ticks = Array.from(section.querySelectorAll<HTMLElement>('[data-tick]'));
    const bar = section.querySelector<HTMLElement>('[data-bar]');
    let last = -1;

    const apply = (p: number) => {
      progress.current = p;
      stage.setProgress(p);
      caps.forEach((cap, i) => {
        const start = SCENES[i]!;
        const end = SCENES[i + 1]!;
        const fadeIn = i === 0 ? 1 : smooth(start - 0.015, start + 0.035, p);
        const fadeOut = i === caps.length - 1 ? 0 : smooth(end - 0.035, end + 0.005, p);
        const on = fadeIn * (1 - fadeOut);
        cap.style.setProperty('--on', on.toFixed(3));
        cap.classList.toggle('is-active', on > 0.55);
      });
      const idx = Math.min(5, SCENES.findIndex((v, i) => p >= v && p < SCENES[i + 1]!) === -1 ? 5 : SCENES.findIndex((v, i) => p >= v && p < SCENES[i + 1]!));
      if (idx !== last) {
        last = idx;
        section.dataset.scene = String(idx);
        ticks.forEach((tick, i) => tick.classList.toggle('is-on', i === idx));
      }
      if (bar) bar.style.transform = `scaleY(${p.toFixed(3)})`;
      section.classList.toggle('is-scrolled', p > 0.02);
    };
    apply(0);

    const trigger = ScrollTrigger.create({ trigger: section, start: 'top top', end: 'bottom bottom', onUpdate: (self) => apply(self.progress) });
    const io = new IntersectionObserver(([entry]) => stage.setActive(!!entry?.isIntersecting), { rootMargin: '10% 0px' });
    io.observe(section);
    const ro = new ResizeObserver(() => {
      stage.resize();
      ScrollTrigger.refresh();
    });
    ro.observe(mount);

    return () => {
      trigger.kill();
      io.disconnect();
      ro.disconnect();
      stage.dispose();
    };
  }, [mode, master]);

  const heroCaption = (
    <div className="gm-film__cap gm-film__cap--hero" data-cap>
      <p className="gm-film__label">{content.eyebrow}</p>
      <h1>
        <span>{content.title}</span> <em>{content.highlight}</em>
      </h1>
      <p className="gm-film__text">{content.lead}</p>
      {!master && (
        <ul className="gm-film__inputs" aria-label={t('Muammoni tasvirlash usullari')}>
          {INPUT_METHODS.map((method) => (
            <li key={method.label}>
              <method.icon size={14} /> {method.label}
            </li>
          ))}
        </ul>
      )}
      <div className="gm-film__cta">
        <Link to="/register" className="gm-button gm-button--primary gm-button--md">
          {content.primaryCta} <ArrowRight size={16} />
        </Link>
        <a href="#qanday" className="gm-button gm-button--secondary gm-button--md">
          {content.secondaryCta}
        </a>
      </div>
    </div>
  );

  if (mode !== 'film') {
    // WebGL yo‘q yoki harakat kamaytirilgan: sahnalar oddiy, o‘qiladigan ketma-ketlik sifatida.
    return (
      <section className="gm-film gm-film--static" aria-label="GetMaster" ref={sectionRef}>
        <ShaderBackground variant="brand" />
        <div className="gm-film__static-inner">
          {heroCaption}
          <ol className="gm-film__static-list">
            {scenes.map((scene) => (
              <li key={scene.label}>
                <span className="gm-film__label">{scene.label}</span>
                <strong>{scene.title}</strong>
                <p>{scene.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section className="gm-film" ref={sectionRef} data-scene="0" aria-label={t('GetMaster: muammodan natijagacha')}>
      <div className="gm-film__sticky">
        <ShaderBackground variant="brand" />
        {video.available && (
          <ScrollVideo
            className="gm-film__video"
            progress={progress}
            sources={[{ src: `${video.base}.webm`, type: 'video/webm' }, { src: `${video.base}.mp4`, type: 'video/mp4' }]}
            mobileSources={[{ src: `${video.base}-m.mp4`, type: 'video/mp4' }]}
            poster={`${video.base}.jpg`}
            label={t('Ish jarayoni videosi')}
          />
        )}
        <div className="gm-film__scrim" aria-hidden="true" />
        <div ref={stageRef} className="gm-film__stage" aria-hidden="true" />

        {heroCaption}
        {scenes.map((scene, i) => (
          <div key={scene.label} className={i === scenes.length - 1 ? 'gm-film__cap gm-film__cap--final' : 'gm-film__cap'} data-cap>
            <p className="gm-film__label">{scene.label}</p>
            <h2>{scene.title}</h2>
            <p className="gm-film__text">{scene.text}</p>
            {i === scenes.length - 1 && (
              <div className="gm-film__cta">
                <Link to="/register" className="gm-button gm-button--primary gm-button--md">
                  {content.primaryCta} <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </div>
        ))}

        <ol className="gm-film__index" aria-hidden="true">
          {names.map((name, i) => (
            <li key={name} data-tick className={i === 0 ? 'is-on' : undefined}>
              <b>{String(i + 1).padStart(2, '0')}</b>
              <span>{name}</span>
            </li>
          ))}
        </ol>
        <div className="gm-film__rail" aria-hidden="true">
          <i data-bar />
        </div>
        <div className="gm-film__hint" aria-hidden="true">
          <span>{t('Skroll')}</span>
          <i />
        </div>
      </div>
    </section>
  );
}
