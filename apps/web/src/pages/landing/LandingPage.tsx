import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, MapPin, Star } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { env } from '@/lib/env';
import { CATEGORIES, CUSTOMER_CONTENT, INPUT_METHODS, MASTER_CONTENT } from './landing-content';
import type { LandingContent } from './landing-content';
import '@/components/ui/Button.css';
import '@/components/ui/Badge.css';
import { Cursor } from './fx/Cursor';
import { Marquee } from './fx/Marquee';
import { StepsGrid } from './fx/StepsGrid';
import { Statement } from './fx/Statement';
import { ShaderBackground } from './fx/ShaderBackground';
import { magneticHandlers, tiltHandlers } from './fx/interactions';
import { useSmoothScroll } from './fx/useSmoothScroll';
import './Landing.css';

const Hero3D = lazy(() => import('./fx/Hero3D'));

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
import { t } from '@/i18n';

function HeroPreview({ master }: { master: boolean }) {
  return (
    <div className="gm-hero-preview" aria-hidden="true">
      <div className="gm-hero-preview__card gm-hero-preview__card--main">
        <div className="gm-hero-preview__row">
          <span className="gm-badge gm-badge--primary">{master ? t('Yangi so‘rov') : t('So‘rovingiz')}</span>
          <span className="gm-hero-preview__time">{t('2 daqiqa oldin')}</span>
        </div>
        <h3>{t('Oshxonadagi kran oqyapti')}</h3>
        <p className="gm-hero-preview__meta">
          <MapPin size={14} />{' '}{t('Chilonzor, Toshkent · 1.2 km')}</p>
        <div className="gm-hero-preview__chips">
          <span>{t('Santexnika')}</span>
          <span>{t('Bugun')}</span>
          <span>{t('3 ta foto')}</span>
        </div>
      </div>

      {[
        { name: 'Aziz R.', price: '150 000', rating: '4.9', jobs: 128 },
        { name: 'Jasur T.', price: '170 000', rating: '4.8', jobs: 96 },
      ].map((offer, index) => (
        <div key={offer.name} className={`gm-hero-preview__card gm-hero-preview__offer gm-hero-preview__offer--${index + 1}`}>
          <span className="gm-avatar">{offer.name[0]}</span>
          <div className="gm-hero-preview__offer-body">
            <strong>
              {offer.name} <BadgeCheck size={15} className="gm-hero-preview__verified" />
            </strong>
            <span>
              <Star size={13} fill="currentColor" />{' '}{t('{rating} · {jobs} ta ish', { rating: offer.rating, jobs: offer.jobs })}</span>
          </div>
          <div className="gm-hero-preview__price">
            {offer.price} <small>{t('so‘m')}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Sarlavhani so‘zlarga bo‘lib, har birini ketma-ket paydo qiladi (CSS animatsiya). */
function Words({ text, offset = 0 }: { text: string; offset?: number }) {
  return (
    <>
      {text.split(' ').map((word, index) => (
        <span key={`${word}-${index}`} className="gm-lw" style={{ ['--i' as string]: index + offset }}>
          {word}
        </span>
      ))}
    </>
  );
}

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

function Landing({ content, master }: { content: LandingContent; master: boolean }) {
  useScrollReveal();
  useSmoothScroll();
  const [webgl, setWebgl] = useState(false);
  const [atTop, setAtTop] = useState(true);
  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    setWebgl(webglAvailable() && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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

      <section className="gm-landing__hero">
        {webgl && <ShaderBackground variant="brand" />}
        {webgl && (
          <Suspense fallback={null}>
            <Hero3D />
          </Suspense>
        )}
        <div className="gm-landing__hero-inner">
          <div className="gm-landing__hero-copy">
            <span className="gm-landing__eyebrow">{content.eyebrow}</span>
            <h1 aria-label={`${content.title} ${content.highlight}`}>
              <span aria-hidden="true">
                <Words text={content.title} />
                <span className="gm-landing__hl">
                  <Words text={content.highlight} offset={content.title.split(' ').length} />
                </span>
              </span>
            </h1>
            <p>{content.lead}</p>
            <div className="gm-landing__cta-row">
              <Link to="/register" className="gm-button gm-button--primary gm-button--md gm-magnetic" {...magneticHandlers}>
                {content.primaryCta} <ArrowRight size={18} />
              </Link>
              <a href="#qanday" className="gm-button gm-button--secondary gm-button--md gm-magnetic" {...magneticHandlers}>
                {content.secondaryCta}
              </a>
            </div>
            {!master && (
              <ul className="gm-landing__inputs" aria-label={t('Muammoni tasvirlash usullari')}>
                {INPUT_METHODS.map((method) => (
                  <li key={method.label}>
                    <method.icon size={16} /> {method.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <HeroPreview master={master} />
        </div>
      </section>

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
  return <Landing content={master ? MASTER_CONTENT : CUSTOMER_CONTENT} master={master} />;
}
