import { DeviceList } from '@/features/auth/components/DeviceList';
import { useState } from 'react';
import { UI_SIZES, getUiSize, setUiSize, type UiSize } from '@/lib/ui-size';
import { Button } from '@/components/ui/Button';
import { GoogleLinkSettings } from '@/features/session/components/GoogleLinkSettings';
import { TwoFactorSettings } from '@/features/session/components/TwoFactorSettings';
import { LanguageSettings } from '@/features/session/components/LanguageSettings';
import './SettingsPage.css';
import { t } from '@/i18n';

export function SettingsPage() {
  const [size, setSize] = useState<UiSize>(getUiSize);

  function choose(next: UiSize) {
    setSize(next);
    setUiSize(next);
  }

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>{t('Sozlamalar')}</h1>
          <p className="gm-page-lead">{t('Akkauntingiz xavfsizligi va ulangan qurilmalarni boshqaring.')}</p>
        </div>
      </div>

      <section className="gm-detail-section" style={{ marginTop: 0 }}>
        <h2>{t('Tugmalar o‘lchami')}</h2>
        <div className="gm-size-picker" role="radiogroup" aria-label={t('Tugmalar o‘lchami')}>
          {UI_SIZES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={size === option.value}
              className={size === option.value ? 'gm-size-picker__item gm-size-picker__item--active' : 'gm-size-picker__item'}
              onClick={() => choose(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="gm-size-preview">
          <Button size="sm">{t('Kichik tugma')}</Button>
          <Button>{t('O‘rtacha tugma')}</Button>
          <Button size="lg">{t('Katta tugma')}</Button>
        </div>
      </section>

      <LanguageSettings />

      <TwoFactorSettings />

      <GoogleLinkSettings />

      <section className="gm-detail-section">
        <h2>{t('Faol qurilmalar')}</h2>
        <DeviceList />
      </section>
    </div>
  );
}
