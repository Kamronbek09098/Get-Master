import { MapPin, Ruler } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CoverageMap } from './CoverageMap';
import './geo.css';
import { t } from '@/i18n';

export interface CoverageDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  lat: number | null;
  lon: number | null;
  radiusKm: number | null;
  /** Tanlangan hudud nomi (masalan, «Yunusobod»). */
  area?: string | null;
  areas?: string[];
  /** Ommaviy ko‘rinishda markaz ~1 km aniqlikda. */
  approximate?: boolean;
}

/** Ustaning ish hududi: markaz va radius xaritada to‘liq ajratib ko‘rsatiladi. */
export function CoverageDialog({ open, onClose, title, lat, lon, radiusKm, area, areas = [], approximate = false }: CoverageDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} wide footer={<Button onClick={onClose}>{t('Yopish')}</Button>}>
      <div className="gm-covdlg">
        <div className="gm-covdlg__chips">
          {area && (
            <span className="gm-covdlg__chip gm-covdlg__chip--accent">
              <MapPin size={14} aria-hidden="true" /> {area}
            </span>
          )}
          <span className="gm-covdlg__chip">
            <Ruler size={14} aria-hidden="true" />{' '}{t('Ish radiusi:')}{' '}<strong>{radiusKm ? `${radiusKm} km` : '—'}</strong>
          </span>
          {areas
            .filter((item) => item !== area)
            .map((item) => (
              <span key={item} className="gm-covdlg__chip">
                {item}
              </span>
            ))}
        </div>
        <CoverageMap latitude={lat} longitude={lon} radiusKm={radiusKm} height="min(58dvh, 460px)" wheelZoom />
        <p className="gm-covdlg__note">{t('Ko‘k doira — usta ishlay oladigan hudud: markazdan')}{' '}{radiusKm ? `${radiusKm} km` : 'belgilangan'}{' '}{t('masofagacha bo‘lgan manzillarga keladi.')}{approximate && t(' Usta joylashuvi maxfiylik uchun taxminan (~1 km) ko‘rsatilgan.')}
        </p>
      </div>
    </Modal>
  );
}
