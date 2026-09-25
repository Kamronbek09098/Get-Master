import { DeviceList } from '@/features/auth/components/DeviceList';
import './SettingsPage.css';

export function SettingsPage() {
  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>Sozlamalar</h1>
          <p className="gm-page-lead">Akkauntingiz xavfsizligi va ulangan qurilmalarni boshqaring.</p>
        </div>
      </div>

      <section className="gm-detail-section" style={{ marginTop: 0 }}>
        <h2>Faol qurilmalar</h2>
        <DeviceList />
      </section>
    </div>
  );
}
