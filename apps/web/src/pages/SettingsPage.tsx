import { DeviceList } from '@/features/auth/components/DeviceList';
import { useState } from 'react';
import { UI_SIZES, getUiSize, setUiSize, type UiSize } from '@/lib/ui-size';
import { Button } from '@/components/ui/Button';
import { TwoFactorSettings } from '@/features/session/components/TwoFactorSettings';
import './SettingsPage.css';

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
          <h1>Sozlamalar</h1>
          <p className="gm-page-lead">Akkauntingiz xavfsizligi va ulangan qurilmalarni boshqaring.</p>
        </div>
      </div>

      <section className="gm-detail-section" style={{ marginTop: 0 }}>
        <h2>Tugmalar o‘lchami</h2>
        <div className="gm-size-picker" role="radiogroup" aria-label="Tugmalar o‘lchami">
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
          <Button size="sm">Kichik tugma</Button>
          <Button>O‘rtacha tugma</Button>
          <Button size="lg">Katta tugma</Button>
        </div>
      </section>

      <TwoFactorSettings />

      <section className="gm-detail-section">
        <h2>Faol qurilmalar</h2>
        <DeviceList />
      </section>
    </div>
  );
}
