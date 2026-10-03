import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { env } from '@/lib/env';
import { CATEGORIES, CUSTOMER_CONTENT, MASTER_CONTENT } from './landing-content';
import type { LandingContent } from './landing-content';
import '@/components/ui/Button.css';
import '@/components/ui/Badge.css';
import { Cursor } from './fx/Cursor';
import { Marquee } from './fx/Marquee';
import { StepsGrid } from './fx/StepsGrid';
import { Statement } from './fx/Statement';
import { tiltHandlers } from './fx/interactions';
import { useAvailableStories } from './story/useAvailableStories';
import { useSmoothScroll } from './fx/useSmoothScroll';
import './Landing.css';
import './story/story.css';

// Three.js va GSAP faqat landing ochilganda alohida bo‘lak sifatida yuklanadi.
const ShaderBackground = lazy(() => import('./fx/ShaderBackground').then((module) => ({ default: module.ShaderBackground })));
const RealStory = lazy(() => import('./story/RealStory').then((module) => ({ default: module.RealStory })));

/**
 * Kinematografik bosh qism. Asosiy hikoya — HAQIQIY dunyoda (skroll boshqaradigan haqiqiy video).
 * Video hali qo‘yilmagan bo‘lsa, 3D/abstrakt narsa ko‘rsatilmaydi — oddiy sokin bosh qism turadi.
 */
function CalmHero({ content }: { content: LandingContent }) {
  return (
    <section className="gm-rs-calm">
      <Suspense fallback={null}>
        <ShaderBackground variant="brand" />
      </Suspense>
      <div className="gm-rs__hero">
        <p className="gm-rs__label">{content.eyebrow}</p>
        <h1>
          <span>{content.title}</span> <em>{content.highlight}</em>
        </h1>
        <p className="gm-rs__text">{content.lead}</p>
        <div className="gm-rs__cta">
          <Link to="/register" className="gm-button gm-button--primary gm-button--md">
            {content.primaryCta} <ArrowRight size={16} />
          </Link>
          <a href="#qanday" className="gm-button gm-button--secondary gm-button--md">
            {content.secondaryCta}
          </a>
        </div>
      </div>
    </section>
  );
}

function CinematicHero({ content }: { content: LandingContent }) {
  const { status, stories } = useAvailableStories();
  if (status === 'pending') return <div className="gm-film-placeholder" aria-hidden="true" />;
  return (
    <Suspense fallback={<div className="gm-film-placeholder" aria-hidden="true" />}>
      {stories.length > 0 ? <RealStory content={content} stories={stories} /> : <CalmHero content={content} />}
    </Suspense>
  );
}

import { t } from '@/i18n';

/** Ko‘rinish maydoniga kirgan `data-reveal` elementlarni ketma-ket ochadi (prefers-reduced-motion hurmat qilinadi). */
function useScrollReveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((node) => node.classList.add('is-in'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

function Landing({ content }: { content: LandingContent }) {
  useScrollReveal();
  useSmoothScroll();
  const [atTop, setAtTop] = useState(true);
  useEffect(() => {
    const onScroll = () => {
      const film = document.querySelector('.gm-film, .gm-rs');
      setAtTop(film ? film.getBoundingClientRect().bottom > 90 : window.scrollY < 40);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div className="gm-landing">
      <div id="gm-scroll-progress" className="gm-scroll-progress" aria-hidden="true" />
      <Cursor />
      <header className={atTop ? 'gm-landing__nav is-top' : 'gm-landing__nav'}>
        <div className="gm-landing__nav-inner">
          <Link to="/" aria-label="GetMaster">
            <Logo />
          </Link>
          <nav className="gm-landing__links" aria-label={t('Bo‘limlar')}>
            <a href="#qanday">{t('Qanday ishlaydi')}</a>
            {content.showCategories && <a href="#xizmatlar">{t('Xizmatlar')}</a>}
            <a href="#ishonch">{t('Ishonch')}</a>
          </nav>
          <div className="gm-landing__nav-actions">
            <ThemeToggle />
            <Link to="/login" className="gm-button gm-button--ghost gm-button--md">{t('Kirish')}</Link>
            <Link to="/register" className="gm-button gm-button--primary gm-button--md">{t('Ro‘yxatdan o‘tish')}</Link>
          </div>
        </div>
      </header>

      <CinematicHero content={content} />

      <section className="gm-landing__stats" aria-label={t('Qisqacha')}>
        {content.stats.map((stat) => (
          <div key={stat.label} className="gm-landing__stat" data-reveal style={{ ['--i' as string]: content.stats.indexOf(stat) }}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </section>

      <Marquee items={CATEGORIES} />

      <Statement label={content.statementLabel} text={content.statement} />

      <StepsGrid title={content.stepsTitle} steps={content.steps} />

      {content.showCategories && (
        <section className="gm-landing__section" id="xizmatlar">
          <h2 data-reveal>{t('Mashhur xizmatlar')}</h2>
          <div className="gm-landing__categories">
            {CATEGORIES.map((category, index) => (
              <Link key={category.name} to="/register" className="gm-landing__category gm-tilt" {...tiltHandlers} data-reveal style={{ ['--i' as string]: index % 6 }}>
                <span>
                  <category.icon size={26} strokeWidth={1.9} />
                </span>
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="gm-landing__section" id="ishonch">
        <h2 data-reveal>{content.trustTitle}</h2>
        <div className="gm-landing__trust">
          {content.trust.map((item, index) => (
            <div key={item.title} className="gm-landing__trust-card gm-tilt" {...tiltHandlers} data-reveal style={{ ['--i' as string]: index }}>
              <span className="gm-landing__step-icon">
                <item.icon size={24} strokeWidth={2} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="gm-landing__cta" data-reveal>
        <div>
          <h2>{content.ctaTitle}</h2>
          <p>{content.ctaText}</p>
        </div>
        <Link to="/register" className="gm-button gm-button--accent gm-button--md">
          {content.primaryCta} <ArrowRight size={18} />
        </Link>
      </section>

      <footer className="gm-landing__footer">
        <Logo />
        <p>{t('© {getFullYear} GetMaster. Barcha huquqlar himoyalangan.', { getFullYear: new Date().getFullYear() })}</p>
      </footer>
    </div>
  );
}

export function LandingPage() {
  const master = env.appRole === 'MASTER';
  return <Landing content={master ? MASTER_CONTENT : CUSTOMER_CONTENT} />;
}
