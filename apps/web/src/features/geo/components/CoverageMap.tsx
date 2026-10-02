import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './geo.css';
import { t } from '@/i18n';

export interface CoverageZone {
  id: string;
  lat: number;
  lon: number;
  radiusKm: number;
  label?: string;
}

export interface CoverageMapProps {
  latitude: number | null;
  longitude: number | null;
  /** Ish radiusi, km. Bo‘sh bo‘lsa faqat nuqta ko‘rsatiladi. */
  radiusKm?: number | null;
  /** Mijoz manzili: alohida (qizil) belgi bilan ko‘rsatiladi. */
  point?: { lat: number; lon: number } | null;
  /** Qo‘shimcha ustalarning ish hududlari (yengil doiralar). */
  zones?: CoverageZone[];
  height?: number | string;
  /** Sichqoncha g‘ildiragi bilan yaqinlashtirish (katta xaritada yoqiladi). */
  wheelZoom?: boolean;
}

const TASHKENT: [number, number] = [41.2995, 69.2401];

const pinIcon = (cls: string) => L.divIcon({ className: cls, html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] });

/** Usta ishlay oladigan hududni xaritada ko‘rsatadi: markaz nuqtasi, radius doirasi, mijoz manzili va boshqa ustalar. */
export function CoverageMap({ latitude, longitude, radiusKm, point, zones, height = 280, wheelZoom = false }: CoverageMapProps) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const group = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    if (!holder.current) return;
    const instance = L.map(holder.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: wheelZoom }).setView(TASHKENT, 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(instance);
    group.current = L.featureGroup().addTo(instance);
    map.current = instance;
    // Modal ichida o‘lcham keyin aniqlanadi.
    const resize = window.setTimeout(() => instance.invalidateSize(), 120);
    return () => {
      window.clearTimeout(resize);
      instance.remove();
      map.current = null;
      group.current = null;
    };
  }, [wheelZoom]);

  useEffect(() => {
    const instance = map.current;
    const layer = group.current;
    if (!instance || !layer) return;
    layer.clearLayers();
    const color = getComputedStyle(document.documentElement).getPropertyValue('--gm-color-primary').trim() || '#1a4bff';

    for (const zone of zones ?? []) {
      L.circle([zone.lat, zone.lon], { radius: zone.radiusKm * 1000, color, weight: 1.5, opacity: 0.55, fillColor: color, fillOpacity: 0.07, interactive: false }).addTo(layer);
      const marker = L.marker([zone.lat, zone.lon], { icon: pinIcon('gm-coverage__pin gm-coverage__pin--sm'), interactive: !!zone.label }).addTo(layer);
      if (zone.label) marker.bindTooltip(zone.label, { direction: 'top', offset: [0, -8] });
    }

    if (latitude != null && longitude != null) {
      const center: L.LatLngExpression = [latitude, longitude];
      L.marker(center, { icon: pinIcon('gm-coverage__pin'), interactive: false }).addTo(layer);
      if (radiusKm && radiusKm > 0) {
        L.circle(center, { radius: radiusKm * 1000, color, weight: 2.5, fillColor: color, fillOpacity: 0.18, interactive: false }).addTo(layer);
      }
    }

    if (point) L.marker([point.lat, point.lon], { icon: pinIcon('gm-coverage__pin gm-coverage__pin--home'), interactive: false }).addTo(layer);

    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      const single = !zones?.length && !point && !(radiusKm && radiusKm > 0);
      if (single) instance.setView(bounds.getCenter(), 15);
      else instance.fitBounds(bounds, { padding: [24, 24], animate: true, maxZoom: 16 });
    }
  }, [latitude, longitude, radiusKm, point, zones]);

  const empty = (latitude == null || longitude == null) && !point && !(zones && zones.length > 0);

  return (
    <div className="gm-coverage" style={{ height }}>
      <div ref={holder} className="gm-coverage__map" />
      {empty && <div className="gm-coverage__empty">{t('Manzilni tanlang — ish hududi shu yerda ko‘rinadi')}</div>}
    </div>
  );
}
