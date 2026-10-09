import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Compass, Minus, Plus } from 'lucide-react';
import type { LatLon } from '../geometry';
import type { LivePosition } from '../useLiveLocation';
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
  onToggleHeadingUp?: () => void;
}

/** OpenFreeMap (bepul, kalitsiz, OpenStreetMap ma’lumoti): vektor xarita — burilganda yozuvlar to‘g‘ri o‘qiladi. */
const STYLE = { light: 'https://tiles.openfreemap.org/styles/bright', dark: 'https://tiles.openfreemap.org/styles/fiord' } as const;
const FOLLOW_PITCH = 55;

const empty = (): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] });
const line = (coords: Array<[number, number]>): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: coords.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }] : [] });
const lines = (list: Array<Array<[number, number]>>): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: list.filter((c) => c.length > 1).map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c } })) });
const themeOf = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

/** Navigatsiya xaritasi (MapLibre): marshrut, o‘tilgan qism, strelka, manzil, yo‘nalish bo‘yicha burilish va 3D qiyalik. */
export function NavMap({ route, passed, alternatives, position, destination, follow, onUserMove, fitKey, followZoom = 17, headingUp = true, onToggleHeadingUp }: NavMapProps) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const data = useRef({ route, passed, alternatives });
  const me = useRef<maplibregl.Marker | null>(null);
  const [zoomOffset, setZoomOffset] = useState(0);
  const [heading, setHeading] = useState(0);
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
      style: STYLE[themeOf()],
      center: [destination.lon, destination.lat],
      zoom: 14,
      maxPitch: 70,
      attributionControl: false,
      fadeDuration: 0,
    });
    instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    instance.on('style.load', addLayers);
    // Atribut (litsenziya talabi) ixcham: bosilganda ochiladi.
    void instance.once('load', () => holder.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
    instance.on('rotate', () => setHeading(instance.getBearing()));
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
    let theme = themeOf();
    const observer = new MutationObserver(() => {
      const next = themeOf();
      if (next === theme) return;
      theme = next;
      ready.current = false;
      instance.setStyle(STYLE[next]);
    });
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
    m.fitBounds(bounds, { padding: { top: 120, bottom: 300, left: 40, right: 40 }, maxZoom: 17, duration: 700, bearing: 0, pitch: 0 });
  }, [fitKey, route, follow]);

  // Joriy joylashuv va kuzatuv
  useEffect(() => {
    const m = map.current;
    if (!m || !position) return;
    if (!me.current) {
      const el = document.createElement('div');
      el.className = 'gn-me';
      el.innerHTML = '<span class="gn-me__acc"></span><span class="gn-me__arrow"><svg viewBox="0 0 40 40" width="40" height="40"><path d="M20 3 33 34 20 27 7 34Z" fill="#2563eb" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg></span>';
      me.current = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat([position.lon, position.lat]).addTo(m);
    }
    me.current.setLngLat([position.lon, position.lat]);
    me.current.setRotation(position.heading ?? 0);
    if (follow) {
      const zoom = Math.min(19, Math.max(12, followZoom + zoomOffset));
      const h = holder.current?.clientHeight ?? 700;
      m.easeTo({
        center: [position.lon, position.lat],
        zoom,
        bearing: rotated ? (position.heading ?? 0) : 0,
        pitch: rotated ? FOLLOW_PITCH : 0,
        // Joylashuv ekranning pastki qismida turadi: oldinga qaraydigan joy ko‘proq.
        padding: { top: rotated ? h * 0.32 : 0, bottom: 0, left: 0, right: 0 },
        duration: 900,
        easing: (x) => x,
        essential: true,
      });
    }
  }, [position, follow, followZoom, zoomOffset, rotated]);

  const zoomBy = (delta: number) => {
    if (follow) setZoomOffset((value) => Math.max(-4, Math.min(2, value + delta)));
    else if (delta > 0) map.current?.zoomIn();
    else map.current?.zoomOut();
  };

  return (
    <div className="gn-mapbox">
      <div ref={holder} className="gn-map" role="application" aria-label={t('Xarita')} />
      <div className="gn-zoom" role="group" aria-label={t('Masshtab')}>
        <button type="button" onClick={() => zoomBy(1)} aria-label={t('Yaqinlashtirish')}><Plus size={20} aria-hidden="true" /></button>
        <button type="button" onClick={() => zoomBy(-1)} aria-label={t('Uzoqlashtirish')}><Minus size={20} aria-hidden="true" /></button>
        {onToggleHeadingUp && (
          <button type="button" className={headingUp ? 'is-on' : undefined} onClick={onToggleHeadingUp} aria-pressed={headingUp} aria-label={headingUp ? t('Shimol tepada') : t('Yo‘nalish tepada')}>
            <Compass size={20} style={{ transform: `rotate(${-heading}deg)` }} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
