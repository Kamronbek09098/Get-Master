import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LatLon } from '../geometry';
import type { ReactNode } from 'react';
import type { LivePosition } from '../useLiveLocation';
import { env } from '@/lib/env';
import { t } from '@/i18n';
import './navigation.css';

export interface NavMapProps {
  /** [lon, lat] */
  route: Array<[number, number]> | null;
  /** Marshrutda bosib o‘tilgan nuqtalar soni (qolgani ko‘k, o‘tgani kulrang). */
  passed: number;
  alternatives: Array<Array<[number, number]>>;
  position: LivePosition | null;
  destination: LatLon;
  follow: boolean;
  onUserMove: () => void;
  fitKey: string;
  /** Kuzatuv yaqinlashtirish darajasi (tezlikka qarab). */
  followZoom?: number;
  /** Xarita harakat yo‘nalishi tepada bo‘lib buriladi va 3D qiyalik oladi (kuzatuv yoqilganda). */
  headingUp?: boolean;
  /** Marker qaragan yo‘nalish: harakatda — yo‘l bo‘yicha, turganda — telefon kompasi. */
  markerHeading?: number | null;
  /** Marker kompas bo‘yicha burilgan (nur konusi ko‘rinadi). */
  compassActive?: boolean;
  /** Xarita mavzusi: «auto» — ilova mavzusiga qarab. */
  mapTheme?: 'auto' | 'light' | 'dark';
  /** Keyingi burilish nuqtasi (xaritada ko‘k belgi shu joyda turadi) va belgi ichidagi tarkib. */
  maneuverAt?: LatLon | null;
  maneuverSign?: ReactNode;
  /** Burilish nuqtasi ekranda ko‘rinyaptimi (ko‘rinmasa, tepada belgi chiqadi). */
  onManeuverVisible?: (visible: boolean) => void;
  /** Xarita burilish burchagi (kompas tugmasi uchun). */
  onBearing?: (deg: number) => void;
  /** Pastki panel balandligi (px): xarita shu qismni hisobga olib joylashadi. */
  bottomInset?: number;
  /** Qiymat o‘zgarganda butun marshrutni ko‘rsatadi («Marshrut sharhi»). */
  overviewKey?: number;
}

/** OpenFreeMap (bepul, kalitsiz, OpenStreetMap ma’lumoti): vektor xarita — burilganda yozuvlar to‘g‘ri o‘qiladi. */
const OFM = 'https://tiles.openfreemap.org';
/** Xarita fayllari ilovaning o‘z API manzili orqali olinadi (telefon tarmog‘ida tashqi xarita serveri ochilmasligi mumkin); ishlamasa — to‘g‘ridan-to‘g‘ri. */
const PROXY = `${env.apiBaseUrl}/geo/map`;
const STYLE = { light: `${PROXY}/styles/bright`, dark: `${PROXY}/styles/fiord` } as const;
const DIRECT = { light: `${OFM}/styles/bright`, dark: `${OFM}/styles/fiord` } as const;
const FOLLOW_PITCH = 55;

const empty = (): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] });
const line = (coords: Array<[number, number]>): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: coords.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] : [] });
const lines = (list: Array<Array<[number, number]>>): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: list.filter((c) => c.length > 1).map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c } })) });
const appTheme = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
const resolveTheme = (pref: 'auto' | 'light' | 'dark') => (pref === 'auto' ? appTheme() : pref);

/** Navigatsiya xaritasi (MapLibre): marshrut, o‘tilgan qism, strelka, manzil, yo‘nalish bo‘yicha burilish va 3D qiyalik. */
export function NavMap({ route, passed, alternatives, position, destination, follow, onUserMove, fitKey, followZoom = 17, headingUp = true, markerHeading = null, compassActive = false, mapTheme = 'auto', maneuverAt = null, maneuverSign = null, onManeuverVisible, onBearing, bottomInset = 0, overviewKey = 0 }: NavMapProps) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const data = useRef({ route, passed, alternatives });
  const me = useRef<maplibregl.Marker | null>(null);
  const glide = useRef(0);
  const headingRef = useRef(0);
  const signMarker = useRef<maplibregl.Marker | null>(null);
  const [signEl] = useState(() => {
    const el = document.createElement('div');
    el.className = 'gn-sign';
    return el;
  });
  const inset = useRef(bottomInset);
  inset.current = bottomInset;
  const visibleCb = useRef(onManeuverVisible);
  visibleCb.current = onManeuverVisible;
  const bearingCb = useRef(onBearing);
  bearingCb.current = onBearing;
  const signAt = useRef<LatLon | null>(maneuverAt);
  signAt.current = maneuverAt;
  const themePref = useRef(mapTheme);
  themePref.current = mapTheme;
  const themeApply = useRef<() => void>(() => undefined);
  const onMove = useRef(onUserMove);
  onMove.current = onUserMove;
  const rotated = headingUp && follow && !!position && position.heading != null;

  const paint = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const d = data.current;
    const set = (id: string, value: GeoJSON.FeatureCollection) => (m.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(value);
    set('nav-alt', lines(d.alternatives));
    set('nav-done', d.route ? line(d.route.slice(0, Math.max(2, d.passed + 1))) : empty());
    set('nav-todo', d.route ? line(d.route.slice(Math.max(0, d.passed))) : empty());
  };

  const addLayers = () => {
    const m = map.current;
    if (!m) return;
    for (const id of ['nav-alt', 'nav-done', 'nav-todo']) if (!m.getSource(id)) m.addSource(id, { type: 'geojson', data: empty() });
    if (!m.getLayer('nav-alt')) m.addLayer({ id: 'nav-alt', type: 'line', source: 'nav-alt', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#7b8db5', 'line-width': 6, 'line-opacity': 0.75, 'line-dasharray': [0.5, 2] } });
    if (!m.getLayer('nav-done')) m.addLayer({ id: 'nav-done', type: 'line', source: 'nav-done', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#9aa4b8', 'line-width': 9, 'line-opacity': 0.9 } });
    if (!m.getLayer('nav-todo-casing')) m.addLayer({ id: 'nav-todo-casing', type: 'line', source: 'nav-todo', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 14, 'line-opacity': 0.95 } });
    if (!m.getLayer('nav-todo')) m.addLayer({ id: 'nav-todo', type: 'line', source: 'nav-todo', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#2563eb', 'line-width': 9 } });
    ready.current = true;
    paint();
  };

  useEffect(() => {
    if (!holder.current) return;
    const instance = new maplibregl.Map({
      container: holder.current,
      style: STYLE[resolveTheme(mapTheme)],
      center: [destination.lon, destination.lat],
      zoom: 14,
      maxPitch: 70,
      attributionControl: false,
      fadeDuration: 0,
    });
    instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    instance.on('style.load', addLayers);
    // Uslub 10 soniyada yuklanmasa (proksi ishlamasa) — to‘g‘ridan-to‘g‘ri manbaga o‘tamiz; u ham bo‘lmasa, qayta urinib turamiz.
    let fellBack = false;
    const rescue = window.setTimeout(() => {
      if (!ready.current && !fellBack) {
        fellBack = true;
        instance.setStyle(DIRECT[resolveTheme(themePref.current)]);
      }
    }, 10_000);
    void instance.once('style.load', () => window.clearTimeout(rescue));
    // Atribut (litsenziya talabi) ixcham: bosilganda ochiladi.
    void instance.once('load', () => holder.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
    instance.on('rotate', () => bearingCb.current?.(instance.getBearing()));
    const checkSign = () => {
      const at = signAt.current;
      if (!at || !visibleCb.current) return;
      const point = instance.project([at.lon, at.lat]);
      const box = instance.getContainer().getBoundingClientRect();
      const inside = point.x > 24 && point.x < box.width - 24 && point.y > 96 && point.y < box.height - inset.current - 24;
      visibleCb.current(inside);
    };
    instance.on('move', checkSign);
    instance.on('moveend', checkSign);
    // Foydalanuvchi o‘zi surganda (barmoq/sichqoncha) kuzatuv o‘chadi; dastur harakati (easeTo) hisobga olinmaydi.
    instance.on('dragstart', (event) => {
      if ((event as { originalEvent?: unknown }).originalEvent) onMove.current();
    });
    const dest = document.createElement('div');
    dest.className = 'gn-pin';
    dest.innerHTML = '<span><i></i></span>';
    new maplibregl.Marker({ element: dest }).setLngLat([destination.lon, destination.lat]).addTo(instance);
    map.current = instance;
    // Mavzu almashsa xarita uslubi ham almashadi.
    let theme = resolveTheme(themePref.current);
    const applyTheme = () => {
      const next = resolveTheme(themePref.current);
      if (next === theme) return;
      theme = next;
      ready.current = false;
      instance.setStyle(STYLE[next]);
    };
    themeApply.current = applyTheme;
    const observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(holder.current);
    return () => {
      observer.disconnect();
      resize.disconnect();
      instance.remove();
      map.current = null;
      me.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    data.current = { route, passed, alternatives };
    paint();
  }, [route, passed, alternatives]);

  // Marshrut yoki rejim o‘zgarganda hamma yo‘lni ko‘rsatish (kuzatuv yoqilmagan paytda)
  useEffect(() => {
    const m = map.current;
    if (!m || !route || route.length < 2 || follow) return;
    const bounds = route.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(route[0], route[0]));
    m.fitBounds(bounds, { padding: { top: 120, bottom: inset.current + 60, left: 40, right: 40 }, maxZoom: 17, duration: 700, bearing: 0, pitch: 0 });
  }, [fitKey, route, follow]);

  // Joriy joylashuv va kuzatuv
  useEffect(() => {
    const m = map.current;
    if (!m || !position) return;
    if (!me.current) {
      const el = document.createElement('div');
      el.className = 'gn-me';
      el.innerHTML =
        '<span class="gn-me__acc"></span>' +
        '<span class="gn-me__dir"><svg class="gn-me__cone" viewBox="0 0 100 100" width="100" height="100" aria-hidden="true"><defs><radialGradient id="gnc" cx="50%" cy="100%" r="100%"><stop offset="0" stop-color="#2563eb" stop-opacity=".55"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/></radialGradient></defs><path d="M50 50 22 6A60 60 0 0 1 78 6Z" fill="url(#gnc)"/></svg>' +
        '<svg class="gn-me__arrow" viewBox="0 0 44 48" width="40" height="44" aria-hidden="true"><defs><linearGradient id="gny" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd84d"/><stop offset="1" stop-color="#f5a800"/></linearGradient></defs><path d="M22 3 40 43 22 34 4 43Z" fill="url(#gny)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M22 3 22 34 4 43Z" fill="#fff2b0" opacity=".55"/><path d="M22 34 40 43 22 3Z" fill="#d98e00" opacity=".55"/></svg></span>';
      me.current = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat([position.lon, position.lat]).addTo(m);
    }
    // Marker joyi tekis siljiydi (GPS 1 s da bir marta keladi): oldingi nuqtadan yangisiga ~0.9 s da interpolyatsiya.
    const marker = me.current;
    const from = marker.getLngLat();
    const to = { lng: position.lon, lat: position.lat };
    cancelAnimationFrame(glide.current);
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 900);
      marker.setLngLat([from.lng + (to.lng - from.lng) * k, from.lat + (to.lat - from.lat) * k]);
      if (k < 1) glide.current = requestAnimationFrame(step);
    };
    if (Math.abs(from.lng - to.lng) + Math.abs(from.lat - to.lat) > 0.01) marker.setLngLat([to.lng, to.lat]);
    else glide.current = requestAnimationFrame(step);
    marker.getElement().classList.toggle('is-compass', compassActive);
    // Noaniqlik doirasi (metrda → pikselga): zoomga qarab o‘lchanadi.
    const acc = marker.getElement().querySelector<HTMLElement>('.gn-me__acc');
    if (acc) {
      const mpp = (156543.03 * Math.cos((position.lat * Math.PI) / 180)) / 2 ** m.getZoom();
      const px = Math.max(30, Math.min(220, (position.accuracy * 2) / mpp));
      acc.style.width = acc.style.height = `${px}px`;
    }
    if (follow) {
      const zoom = Math.min(19, Math.max(12, followZoom));
      const h = holder.current?.clientHeight ?? 700;
      // Pastki panel xaritani yopadi: ko‘rinadigan qismning pastki uchdan bir qismida turish uchun shu balandlik hisobga olinadi.
      const panel = window.innerWidth < 900 ? inset.current : 0;
      const visible = h - panel;
      m.easeTo({
        center: [position.lon, position.lat],
        zoom,
        bearing: rotated ? (position.heading ?? 0) : 0,
        pitch: rotated ? FOLLOW_PITCH : 0,
        // Joylashuv ekranning pastki qismida turadi: oldinga qaraydigan joy ko‘proq.
        padding: { top: rotated ? visible * 0.34 : 0, bottom: panel, left: 0, right: 0 },
        duration: 900,
        easing: (x) => x,
        essential: true,
      });
    }
  }, [position, follow, followZoom, rotated, compassActive]);

  // Marker yo‘nalishi: eng qisqa yo‘l bilan silliq buriladi (0° ↔ 360° sakramaydi)
  useEffect(() => {
    if (!me.current || markerHeading == null) return;
    const delta = ((((markerHeading - headingRef.current) % 360) + 540) % 360) - 180;
    headingRef.current += delta;
    me.current.setRotation(headingRef.current);
  }, [markerHeading, position]);

  // Mavzu sozlamasi o‘zgarsa, xarita uslubi ham o‘zgaradi.
  useEffect(() => {
    themeApply.current();
  }, [mapTheme]);

  // Burilish belgisi: burilish nuqtasida turadi.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!maneuverAt) {
      signMarker.current?.remove();
      signMarker.current = null;
      visibleCb.current?.(false);
      return;
    }
    if (!signMarker.current) signMarker.current = new maplibregl.Marker({ element: signEl, anchor: 'bottom-right', offset: [14, -6], rotationAlignment: 'viewport', pitchAlignment: 'viewport' }).setLngLat([maneuverAt.lon, maneuverAt.lat]).addTo(m);
    else signMarker.current.setLngLat([maneuverAt.lon, maneuverAt.lat]);
    const point = m.project([maneuverAt.lon, maneuverAt.lat]);
    const box = m.getContainer().getBoundingClientRect();
    visibleCb.current?.(point.x > 24 && point.x < box.width - 24 && point.y > 96 && point.y < box.height - inset.current - 24);
  }, [maneuverAt?.lat, maneuverAt?.lon, signEl]);

  // «Marshrut sharhi»: butun yo‘lni ko‘rsatadi.
  useEffect(() => {
    const m = map.current;
    if (!m || !overviewKey || !route || route.length < 2) return;
    const bounds = route.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(route[0], route[0]));
    m.fitBounds(bounds, { padding: { top: 110, bottom: inset.current + 40, left: 40, right: 40 }, maxZoom: 17, duration: 800, bearing: 0, pitch: 0 });
  }, [overviewKey]);

  return (
    <div className="gn-mapbox">
      <div ref={holder} className="gn-map" role="application" aria-label={t('Xarita')} />
      {maneuverSign && createPortal(maneuverSign, signEl)}
    </div>
  );
}
