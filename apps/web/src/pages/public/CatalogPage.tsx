import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, CircleHelp, Crown, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LogoLink } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { env } from '@/lib/env';
import { cx } from '@/lib/utils';
import { FaqSection } from '@/features/public/FaqSection';
import { SupportContacts } from '@/features/public/SupportContacts';
import { usePublicStats } from '@/features/public/hooks';
import { CatalogSection, PlansSection, ServicePricesSection } from '@/features/public/Sections';
import { t } from '@/i18n';
import '@/features/public/public.css';

type TabId = 'ustalar' | 'narxlar' | 'obuna' | 'savollar';

const TABS: Array<{ id: TabId; icon: LucideIcon; label: () => string }> = [
  { id: 'ustalar', icon: Users, label: () => t('Ustalar') },
  { id: 'narxlar', icon: Banknote, label: () => t('Xizmat narxlari') },
  { id: 'obuna', icon: Crown, label: () => t('Obuna') },
  { id: 'savollar', icon: CircleHelp, label: () => t('Savollar') },
];

const isTab = (value: string): value is TabId => TABS.some((tab) => tab.id === value);

/** Yagona qo‘shimcha sahifa: har bir ma’lumot turi o‘z bo‘limida (ustalar, xizmat narxlari, obuna, savollar). Bo‘lim `#hash` bilan ochiladi. */
export function CatalogPage() {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const fromHash = hash.slice(1);
  const tab: TabId = isTab(fromHash) ? fromHash : 'ustalar';
  const [category, setCategory] = useState('');
  const stats = usePublicStats();

  useEffect(() => {
    document.title = `${TABS.find((item) => item.id === tab)!.label()} · GetMaster`;
  }, [tab]);

  const open = useCallback((id: TabId) => navigate({ hash: `#${id}` }, { replace: true }), [navigate]);

  return (
    <div className="gm-pub">
      <header className="gm-pub__bar">
        <div className="gm-pub__bar-in">
          <LogoLink />
          <div className="gm-pub__bar-end">
            <ThemeToggle />
            <a className="gm-pub__cta" href={env.customerUrl}>{t('Kirish')}</a>
          </div>
        </div>
        <nav className="gm-pub__tabs" role="tablist" aria-label={t('Bo‘limlar')}>
          {TABS.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={cx(tab === item.id && 'is-active')} onClick={() => open(item.id)}>
              <item.icon size={20} aria-hidden="true" />
              <span>{item.label()}</span>
              {item.id === 'ustalar' && stats.data && stats.data.masters > 0 && <em>{stats.data.masters}</em>}
            </button>
          ))}
        </nav>
      </header>
      <main className="gm-pub__main" role="tabpanel">
        <Link to="/" className="gm-pub__back"><ArrowLeft size={16} aria-hidden="true" /> {t('Bosh sahifa')}</Link>
        {tab === 'ustalar' && <CatalogSection key={category} initialCategory={category} />}
        {tab === 'narxlar' && <ServicePricesSection onShowMasters={(id) => { setCategory(id); open('ustalar'); window.scrollTo({ top: 0 }); }} />}
        {tab === 'obuna' && <PlansSection />}
        {tab === 'savollar' && <FaqSection />}
      </main>
      <footer className="gm-pub__footer">
        <LogoLink />
        <nav aria-label={t('Havolalar')}>
          <Link to="/">{t('Bosh sahifa')}</Link>
          <Link to="/shartlar">{t('Foydalanish shartlari')}</Link>
        </nav>
        {tab !== 'savollar' && <SupportContacts compact />}
        <p>{t('© {getFullYear} GetMaster. Barcha huquqlar himoyalangan.', { getFullYear: new Date().getFullYear() })}</p>
      </footer>
    </div>
  );
}
