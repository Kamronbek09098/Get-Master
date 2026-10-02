import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, MapPin, Star } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { env } from '@/lib/env';
import { CATEGORIES, CUSTOMER_CONTENT, INPUT_METHODS, MASTER_CONTENT } from './landing-content';
import type { LandingContent } from './landing-content';
import '@/components/ui/Button.css';
import '@/components/ui/Badge.css';
import './Landing.css';
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

function Landing({ content, master }: { content: LandingContent; master: boolean }) {
  return (
    <div className="gm-landing">
      <header className="gm-landing__nav">
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
        <div className="gm-landing__hero-inner">
          <div className="gm-landing__hero-copy">
            <span className="gm-landing__eyebrow">{content.eyebrow}</span>
            <h1>
              {content.title} <span>{content.highlight}</span>
            </h1>
            <p>{content.lead}</p>
            <div className="gm-landing__cta-row">
              <Link to="/register" className="gm-button gm-button--primary gm-button--lg">
                {content.primaryCta} <ArrowRight size={18} />
              </Link>
              <a href="#qanday" className="gm-button gm-button--secondary gm-button--lg">
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
          <div key={stat.label} className="gm-landing__stat">
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </section>

      <section className="gm-landing__section" id="qanday">
        <h2>{content.stepsTitle}</h2>
        <ol className="gm-landing__steps">
          {content.steps.map((step, index) => (
            <li key={step.title} className="gm-landing__step">
              <span className="gm-landing__step-num">{String(index + 1).padStart(2, '0')}</span>
              <span className="gm-landing__step-icon">
                <step.icon size={24} strokeWidth={2} />
              </span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {content.showCategories && (
        <section className="gm-landing__section" id="xizmatlar">
          <h2>{t('Mashhur xizmatlar')}</h2>
          <div className="gm-landing__categories">
            {CATEGORIES.map((category) => (
              <Link key={category.name} to="/register" className="gm-landing__category">
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
        <h2>{content.trustTitle}</h2>
        <div className="gm-landing__trust">
          {content.trust.map((item) => (
            <div key={item.title} className="gm-landing__trust-card">
              <span className="gm-landing__step-icon">
                <item.icon size={24} strokeWidth={2} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="gm-landing__cta">
        <div>
          <h2>{content.ctaTitle}</h2>
          <p>{content.ctaText}</p>
        </div>
        <Link to="/register" className="gm-button gm-button--accent gm-button--lg">
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
