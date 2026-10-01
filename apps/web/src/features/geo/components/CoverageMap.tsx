import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './geo.css';

export interface CoverageMapProps {
  latitude: number | null;
  longitude: number | null;
  /** Ish radiusi, km. Bo‘sh bo‘lsa faqat nuqta ko‘rsatiladi. */
  radiusKm?: number | null;
  height?: number;
}

const TASHKENT: [number, number] = [41.2995, 69.2401];

/** Usta ishlay oladigan hududni xaritada ko‘rsatadi: markaz nuqtasi va radius doirasi. */
export function CoverageMap({ latitude, longitude, radiusKm, height = 280 }: CoverageMapProps) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<{ circle?: L.Circle; marker?: L.Marker }>({});

  useEffect(() => {
    if (!holder.current) return;
    const instance = L.map(holder.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView(TASHKENT, 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(instance);
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
      layers.current = {};
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    layers.current.circle?.remove();
    layers.current.marker?.remove();
    layers.current = {};
    if (latitude == null || longitude == null) return;

    const color = getComputedStyle(document.documentElement).getPropertyValue('--gm-color-primary').trim() || '#1a4bff';
    const center: L.LatLngExpression = [latitude, longitude];
    layers.current.marker = L.marker(center, {
      icon: L.divIcon({ className: 'gm-coverage__pin', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
      interactive: false,
    }).addTo(instance);

    if (radiusKm && radiusKm > 0) {
      const circle = L.circle(center, { radius: radiusKm * 1000, color, weight: 2, fillColor: color, fillOpacity: 0.16 }).addTo(instance);
      layers.current.circle = circle;
      instance.fitBounds(circle.getBounds(), { padding: [20, 20], animate: true, maxZoom: 16 });
    } else {
      instance.setView(center, 15);
    }
  }, [latitude, longitude, radiusKm]);

  return (
    <div className="gm-coverage" style={{ height }}>
      <div ref={holder} className="gm-coverage__map" />
      {(latitude == null || longitude == null) && <div className="gm-coverage__empty">Manzilni tanlang — ish hududi shu yerda ko‘rinadi</div>}
    </div>
  );
}
