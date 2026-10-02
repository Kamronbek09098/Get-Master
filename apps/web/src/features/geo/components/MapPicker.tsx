import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { geoService } from '../geo.service';
import type { GeoPlace } from '../geo.service';
import './geo.css';
import { t } from '@/i18n';

const TASHKENT: [number, number] = [41.2995, 69.2401];

export interface MapPickerProps {
  open: boolean;
  initial?: { latitude: number | null; longitude: number | null } | null;
  onClose: () => void;
  onPick: (place: GeoPlace & { latitude: number; longitude: number }) => void;
}

/** Xaritadan manzil tanlash: xarita siljitilganda markaz belgisi ostidagi manzil aniqlanadi. */
export function MapPicker({ open, initial, onClose, onPick }: MapPickerProps) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [place, setPlace] = useState<GeoPlace | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Modal DOM'i joylashgach xaritani yaratamiz.
    const frame = window.requestAnimationFrame(() => {
      if (!holder.current || map.current) return;
      const start: [number, number] = initial?.latitude != null && initial.longitude != null ? [initial.latitude, initial.longitude] : TASHKENT;
      const instance = L.map(holder.current, { zoomControl: true, attributionControl: true }).setView(start, initial?.latitude != null ? 17 : 12);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(instance);
      map.current = instance;

      const lookup = () => {
        const c = instance.getCenter();
        setCenter({ lat: c.lat, lon: c.lng });
        window.clearTimeout(timer.current);
        setLoading(true);
        setFailed(false);
        timer.current = window.setTimeout(() => {
          geoService
            .reverse(c.lat, c.lng)
            .then((result) => setPlace(result.place))
            .catch(() => {
              setPlace(null);
              setFailed(true);
            })
            .finally(() => setLoading(false));
        }, 450);
      };
      instance.on('moveend', lookup);
      lookup();

      if (initial?.latitude == null && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => instance.setView([position.coords.latitude, position.coords.longitude], 17),
          () => undefined,
          { enableHighAccuracy: true, timeout: 6000 },
        );
      }
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer.current);
      map.current?.remove();
      map.current = null;
      setPlace(null);
      setCenter(null);
    };
  }, [open, initial?.latitude, initial?.longitude]);

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (position) => map.current?.setView([position.coords.latitude, position.coords.longitude], 17),
      () => setFailed(true),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Xaritadan manzil tanlang')}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('Bekor qilish')}</Button>
          <Button
            disabled={!center || loading}
            onClick={() => {
              if (!center) return;
              const base: GeoPlace = place ?? { title: '', subtitle: '', addressLine: `${center.lat.toFixed(5)}, ${center.lon.toFixed(5)}`, city: null, district: null, latitude: null, longitude: null };
              onPick({ ...base, latitude: center.lat, longitude: center.lon });
            }}
          >{t('Shu manzilni tanlash')}</Button>
        </>
      }
    >
      <div className="gm-mappicker">
        <div ref={holder} className="gm-mappicker__map" />
        <span className="gm-mappicker__pin" aria-hidden="true">
          <MapPin size={38} strokeWidth={2.2} />
        </span>
        <button type="button" className="gm-mappicker__locate" onClick={locate} aria-label={t('Joriy joylashuvim')}>
          <LocateFixed size={20} />
        </button>
        <div className="gm-mappicker__address" role="status" aria-live="polite">
          {loading ? t('Manzil aniqlanmoqda…') : failed ? t('Manzilni aniqlab bo‘lmadi. Xaritani siljitib ko‘ring.') : place ? <><strong>{place.addressLine}</strong></> : t('Xaritani siljiting')}
        </div>
      </div>
    </Modal>
  );
}
