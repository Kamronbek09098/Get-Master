import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ScrollVideo } from '@/components/media/ScrollVideo';
import { getGsap } from '@/lib/motion/gsap';
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
 * HAQIQIY XIZMAT CHAQIRUVI: skroll — haqiqiy videoni boshqaradi (pastga — oldinga, yuqoriga — orqaga).
 * Dastur ekrani ko‘rsatilmaydi: hikoya haqiqiy dunyoda (mijoz, usta, uy, asboblar, natija).
 * GetMaster — faqat «ishga tushiruvchi» (kichik yorliq) va yakunda sokin belgi sifatida paydo bo‘ladi.
 */
export function RealStory({ content, stories }: { content: LandingContent; stories: StoryDef[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [activeId, setActiveId] = useState(stories[0]!.id);
  const active = stories.find((story) => story.id === activeId) ?? stories[0]!;
  const [reduced] = useState(prefersReducedMotion);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || reduced) return;
    const { ScrollTrigger } = getGsap();
    const chapters = Array.from(section.querySelectorAll<HTMLElement>('[data-chapter]'));
    const ticks = Array.from(section.querySelectorAll<HTMLElement>('[data-tick]'));
    const hero = section.querySelector<HTMLElement>('[data-hero]');
    const trigger = section.querySelector<HTMLElement>('[data-trigger]');
    const brand = section.querySelector<HTMLElement>('[data-brand]');
    const bar = section.querySelector<HTMLElement>('[data-bar]');
    const at = active.chapters.map((chapter) => chapter.at);

    const apply = (raw: number) => {
      // Video 0–92% oralig‘ida ijro etiladi; oxirgi 8% — yakuniy kadr «nafas oladi» (mijoz reaksiyasi va sokin belgi).
      const p = Math.min(1, raw / 0.92);
      progress.current = p;
      chapters.forEach((el, i) => {
        const start = at[i]!;
        const end = at[i + 1] ?? 1.01;
        const fadeIn = i === 0 ? 1 : smooth(start - 0.03, start + 0.015, p);
        const fadeOut = i === chapters.length - 1 ? 0 : smooth(end - 0.03, end - 0.005, p);
        // 1-bob (muammo) ustiga hero sarlavha tushadi — shu sabab chuqurroq xiralashadi.
        const on = fadeIn * (1 - fadeOut) * (i === 0 ? 1 - smooth(0.04, 0.09, p) : 1);
        el.style.setProperty('--on', on.toFixed(3));
      });
      let idx = 0;
      at.forEach((v, i) => {
        if (p >= v - 0.001) idx = i;
      });
      ticks.forEach((tick, i) => {
        tick.classList.toggle('is-on', i === idx);
        tick.classList.toggle('is-past', i < idx);
      });
      hero?.style.setProperty('--on', (1 - smooth(0.03, 0.09, p)).toFixed(3));
      // «So‘rov yuborildi» — GetMaster ishga tushiruvchi kichik lahza (≈6–14%).
      trigger?.style.setProperty('--on', (smooth(0.05, 0.08, p) * (1 - smooth(0.12, 0.16, p))).toFixed(3));
      // Yakuniy sokin belgi (≈97–100%).
      brand?.style.setProperty('--on', smooth(0.945, 0.985, raw).toFixed(3));
      if (bar) bar.style.transform = `scaleX(${p.toFixed(3)})`;
      section.classList.toggle('is-scrolled', raw > 0.02);
    };
    apply(0);
    const st = ScrollTrigger.create({ trigger: section, start: 'top top', end: 'bottom bottom', onUpdate: (self) => apply(self.progress) });
    return () => st.kill();
  }, [active, reduced]);

  const seek = (p: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const total = section.offsetHeight - window.innerHeight;
    window.scrollTo({ top: section.offsetTop + total * p, behavior: reduced ? 'auto' : 'smooth' });
  };

  const base = storyBase(active.id);
  const sources = [
    { src: `${base}.webm`, type: 'video/webm' },
    { src: `${base}.mp4`, type: 'video/mp4' },
  ];

  const heroCopy = (
    <div className="gm-rs__hero" data-hero>
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
        <ScrollVideo
          key={active.id}
          className="gm-rs__video"
          progress={progress}
          sources={sources}
          mobileSources={[{ src: `${base}-m.mp4`, type: 'video/mp4' }]}
          poster={`${base}.jpg`}
          label={active.label}
        />
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
        <div className="gm-rs__hint" aria-hidden="true">
          <span>{t('Skroll')}</span>
          <i />
        </div>
      </div>
    </section>
  );
}
