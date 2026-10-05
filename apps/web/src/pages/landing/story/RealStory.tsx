import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { prefersReducedMotion } from '@/lib/motion/tokens';
import { INPUT_METHODS, type LandingContent } from '../landing-content';
import type { StoryDef } from './stories';
import { storyBase } from './useAvailableStories';
import './story.css';
import { t } from '@/i18n';

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/**
 * HAQIQIY XIZMAT CHAQIRUVI: haqiqiy video o‘zi avtomatik (ovozsiz, takrorlanib) ijro etiladi; bosqich yozuvlari video vaqtiga
 * ketma-ket mos keladi. Skroll videoni boshqarmaydi — pastga skroll qilinsa, sahifaning keyingi kartalariga tushiladi.
 * Dastur ekrani ko‘rsatilmaydi: hikoya haqiqiy dunyoda (mijoz, usta, uy, asboblar, natija).
 * GetMaster — faqat «ishga tushiruvchi» (kichik yorliq) va yakunda sokin belgi sifatida paydo bo‘ladi.
 */
export function RealStory({ content, stories }: { content: LandingContent; stories: StoryDef[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeId, setActiveId] = useState(stories[0]!.id);
  const active = stories.find((story) => story.id === activeId) ?? stories[0]!;
  const [reduced] = useState(prefersReducedMotion);

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video || reduced) return;
    const chapters = Array.from(section.querySelectorAll<HTMLElement>('[data-chapter]'));
    const ticks = Array.from(section.querySelectorAll<HTMLElement>('[data-tick]'));
    const trigger = section.querySelector<HTMLElement>('[data-trigger]');
    const brand = section.querySelector<HTMLElement>('[data-brand]');
    const bar = section.querySelector<HTMLElement>('[data-bar]');
    const at = active.chapters.map((chapter) => chapter.at);

    // p — video vaqti (0..1): bosqich yozuvlari, xronologiya va chiziq shunga mos.
    const apply = (p: number) => {
      chapters.forEach((el, i) => {
        const start = at[i]!;
        const end = at[i + 1] ?? 1.01;
        const fadeIn = i === 0 ? 1 : smooth(start - 0.03, start + 0.015, p);
        const fadeOut = i === chapters.length - 1 ? 0 : smooth(end - 0.03, end - 0.005, p);
        el.style.setProperty('--on', (fadeIn * (1 - fadeOut)).toFixed(3));
      });
      let idx = 0;
      at.forEach((v, i) => {
        if (p >= v - 0.001) idx = i;
      });
      ticks.forEach((tick, i) => {
        tick.classList.toggle('is-on', i === idx);
        tick.classList.toggle('is-past', i < idx);
      });
      // «So‘rov yuborildi» — GetMaster ishga tushiruvchi kichik lahza (≈6–14%).
      trigger?.style.setProperty('--on', (smooth(0.05, 0.08, p) * (1 - smooth(0.12, 0.16, p))).toFixed(3));
      // Yakuniy sokin belgi (≈95–100%).
      brand?.style.setProperty('--on', smooth(0.945, 0.985, p).toFixed(3));
      if (bar) bar.style.transform = `scaleX(${p.toFixed(3)})`;
    };

    let frame = 0;
    const tick = () => {
      const duration = video.duration;
      apply(duration > 0 ? Math.min(1, video.currentTime / duration) : 0);
      frame = requestAnimationFrame(tick);
    };
    // Faqat ko‘rinib turganda ijro etiladi (batareya va trafikni tejaydi).
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void video.play().catch(() => undefined);
          if (!frame) frame = requestAnimationFrame(tick);
        } else {
          video.pause();
          cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(section);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [active, reduced]);

  const seek = (p: number) => {
    const video = videoRef.current;
    if (video && video.duration > 0) video.currentTime = Math.min(video.duration - 0.05, p * video.duration);
  };

  const scrollDown = () => window.scrollTo({ top: (sectionRef.current?.offsetTop ?? 0) + (sectionRef.current?.offsetHeight ?? window.innerHeight), behavior: 'smooth' });

  const base = storyBase(active.id);
  // Telefonda yengil (≤720p) nusxa, kompyuterda WebM → MP4.
  const mobile = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches, []);
  const sources = mobile
    ? [{ src: `${base}-m.mp4`, type: 'video/mp4' }]
    : [
        { src: `${base}.webm`, type: 'video/webm' },
        { src: `${base}.mp4`, type: 'video/mp4' },
      ];

  const heroCopy = (
    <div className="gm-rs__hero">
      <p className="gm-rs__label">{content.eyebrow}</p>
      <h1>
        <span>{content.title}</span> <em>{content.highlight}</em>
      </h1>
      <p className="gm-rs__text">{content.lead}</p>
      <ul className="gm-rs__inputs" aria-label={t('Muammoni tasvirlash usullari')}>
        {INPUT_METHODS.map((method) => (
          <li key={method.label}>
            <method.icon size={14} /> {method.label}
          </li>
        ))}
      </ul>
      <div className="gm-rs__cta">
        <Link to="/register" className="gm-button gm-button--primary gm-button--md">
          {content.primaryCta} <ArrowRight size={16} />
        </Link>
        <a href="#qanday" className="gm-button gm-button--secondary gm-button--md">
          {content.secondaryCta}
        </a>
      </div>
    </div>
  );

  const picker =
    stories.length > 1 ? (
      <div className="gm-rs__picker" role="tablist" aria-label={t('Hikoya turi')}>
        {stories.map((story) => (
          <button key={story.id} type="button" role="tab" aria-selected={story.id === active.id} className={story.id === active.id ? 'is-on' : undefined} onClick={() => setActiveId(story.id)}>
            <story.icon size={14} aria-hidden="true" /> {story.label}
          </button>
        ))}
      </div>
    ) : null;

  if (reduced) {
    // Harakat kamaytirilgan: video o‘rniga poster va bosqichlar ketma-ket matn sifatida.
    return (
      <section className="gm-rs gm-rs--static" ref={sectionRef} aria-label={t('Haqiqiy xizmat chaqiruvi')}>
        <img className="gm-rs__poster" src={`${base}.jpg`} alt="" />
        <div className="gm-rs__static">
          {heroCopy}
          {picker}
          <ol className="gm-rs__list">
            {active.chapters.map((chapter) => (
              <li key={chapter.label}>
                <span className="gm-rs__label">{chapter.label}</span>
                <strong>{chapter.title}</strong>
                <p>{chapter.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section className="gm-rs" ref={sectionRef} aria-label={t('Haqiqiy xizmat chaqiruvi')}>
      <div className="gm-rs__sticky">
        <video
          key={active.id + (mobile ? '-m' : '')}
          ref={videoRef}
          className="gm-rs__video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={`${base}.jpg`}
          aria-label={active.label}
        >
          {sources.map((source) => (
            <source key={source.src} src={source.src} type={source.type} />
          ))}
        </video>
        <div className="gm-rs__scrim" aria-hidden="true" />
        {picker}
        {heroCopy}

        <div className="gm-rs__trigger" data-trigger role="status">
          <i aria-hidden="true" /> {t('GetMaster orqali yordam so‘raldi')}
        </div>

        {active.chapters.map((chapter) => (
          <div key={chapter.label} className="gm-rs__chapter" data-chapter>
            <p className="gm-rs__label">{chapter.label}</p>
            <h2>{chapter.title}</h2>
            <p className="gm-rs__text">{chapter.text}</p>
          </div>
        ))}

        <div className="gm-rs__brand" data-brand>
          <span className="gm-rs__mark">
            {t('Get')}
            <b>{t('Master')}</b>
          </span>
          <p>{t('Muammodan yechimgacha. Haqiqiy odamlar, haqiqiy ish.')}</p>
          <Link to="/register" className="gm-button gm-button--primary gm-button--md">
            {content.primaryCta} <ArrowRight size={16} />
          </Link>
        </div>

        <ol className="gm-rs__timeline" aria-label={t('Hikoya bosqichlari')}>
          {active.chapters.map((chapter, i) => (
            <li key={chapter.label} data-tick style={{ left: `${chapter.at * 100}%` }}>
              <button type="button" onClick={() => seek(Math.min(0.995, chapter.at + 0.012))} aria-label={chapter.label}>
                <span>{String(i + 1).padStart(2, '0')}</span>
              </button>
            </li>
          ))}
          <li className="gm-rs__bar" aria-hidden="true">
            <i data-bar />
          </li>
        </ol>
        <button type="button" className="gm-rs__hint" onClick={scrollDown} aria-label={t('Pastga tushish')}>
          <span>{t('Pastga')}</span>
          <i aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
