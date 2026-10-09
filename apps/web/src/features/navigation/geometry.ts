import type { NavRoute, NavStep } from '@/features/geo/geo.service';

export interface LatLon {
  lat: number;
  lon: number;
}

const R = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Ikki nuqta orasidagi masofa (metr, haversine). */
export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** a dan b ga yo‘nalish (0–360°, shimoldan soat yo‘nalishida). */
export function bearing(a: LatLon, b: LatLon): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const toLL = (point: [number, number]): LatLon => ({ lat: point[1], lon: point[0] });

export interface RouteProgress {
  /** Marshrut chizig‘idagi eng yaqin segment boshi. */
  index: number;
  /** Chiziqdan masofa (metr): katta bo‘lsa — yo‘ldan chiqilgan. */
  offRouteM: number;
  remainingM: number;
  remainingS: number;
  /** Joriy bajarilayotgan burilish (steps indeksi) — keyingi manevr `stepIndex + 1`. */
  stepIndex: number;
  /** Keyingi manevrgacha qolgan masofa (metr). */
  toNextM: number;
}

/** Joylashuvni marshrutga bog‘lab, qolgan masofa/vaqt va keyingi burilishni hisoblaydi. */
export function progressOn(route: NavRoute, position: LatLon, hint = 0): RouteProgress {
  const pts = route.geometry;
  let best = { index: 0, dist: Infinity, along: 0 };
  // Avval so‘nggi indeks atrofida qidiriladi (tezroq va orqaga sakramaydi), topilmasa — butun chiziq.
  const scan = (from: number, to: number) => {
    for (let i = from; i < to; i += 1) {
      const a = toLL(pts[i]!);
      const b = toLL(pts[i + 1]!);
      const seg = distanceM(a, b);
      if (seg === 0) continue;
      const cosLat = Math.cos(rad(a.lat));
      const ax = 0, ay = 0;
      const bx = (b.lon - a.lon) * cosLat, by = b.lat - a.lat;
      const px = (position.lon - a.lon) * cosLat, py = position.lat - a.lat;
      const len2 = bx * bx + by * by;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / len2));
      const proj = { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
      const d = distanceM(position, proj);
      if (d < best.dist) best = { index: i, dist: d, along: seg * t };
    }
  };
  const window = 60;
  scan(Math.max(0, hint - 5), Math.min(pts.length - 1, hint + window));
  if (best.dist > 80) scan(0, pts.length - 1);

  let remaining = 0;
  const here = toLL(pts[best.index]!);
  const next = toLL(pts[best.index + 1]!);
  remaining += Math.max(0, distanceM(here, next) - best.along);
  for (let i = best.index + 1; i < pts.length - 1; i += 1) remaining += distanceM(toLL(pts[i]!), toLL(pts[i + 1]!));
  const ratio = route.distanceM > 0 ? Math.min(1, remaining / route.distanceM) : 0;

  // Keyingi manevr: nuqtasi marshrutda joriy joydan oldinda bo‘lgan birinchi qadam.
  let stepIndex = 0;
  let toNext = remaining;
  for (let i = 1; i < route.steps.length; i += 1) {
    const step = route.steps[i]!;
    const stepIdx = nearestIndex(pts, step.location, best.index);
    if (stepIdx >= best.index + (stepIdx === best.index ? 1 : 0)) {
      stepIndex = i - 1;
      let d = Math.max(0, distanceM(here, next) - best.along);
      for (let j = best.index + 1; j < stepIdx; j += 1) d += distanceM(toLL(pts[j]!), toLL(pts[j + 1]!));
      toNext = d;
      break;
    }
  }
  return { index: best.index, offRouteM: best.dist, remainingM: remaining, remainingS: route.durationS * ratio, stepIndex, toNextM: toNext };
}

function nearestIndex(pts: Array<[number, number]>, target: [number, number], from: number): number {
  let best = from;
  let bestD = Infinity;
  for (let i = from; i < pts.length; i += 1) {
    const d = (pts[i]![0] - target[0]) ** 2 + (pts[i]![1] - target[1]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
    if (d === 0) break;
  }
  return best;
}

/** Marshrutning ko‘rsatma qadamlari: oxirgisi — «yetib keldingiz». */
export type Maneuver = 'depart' | 'straight' | 'left' | 'right' | 'slight-left' | 'slight-right' | 'sharp-left' | 'sharp-right' | 'uturn' | 'roundabout' | 'arrive';

export function maneuverOf(step: Pick<NavStep, 'type' | 'modifier'>): Maneuver {
  if (step.type === 'arrive') return 'arrive';
  if (step.type === 'depart') return 'depart';
  if (step.type === 'roundabout' || step.type === 'rotary' || step.type === 'roundabout turn') return 'roundabout';
  switch (step.modifier) {
    case 'left':
      return 'left';
    case 'right':
      return 'right';
    case 'slight left':
      return 'slight-left';
    case 'slight right':
      return 'slight-right';
    case 'sharp left':
      return 'sharp-left';
    case 'sharp right':
      return 'sharp-right';
    case 'uturn':
      return 'uturn';
    default:
      return 'straight';
  }
}

/** 1250 → «1,3 km», 340 → «340 m» (50 m ga yaxlitlanadi). */
export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(meters >= 10_000 ? 0 : 1).replace('.', ',')} km`;
  return `${Math.max(10, Math.round(meters / (meters < 100 ? 10 : 50)) * (meters < 100 ? 10 : 50))} m`;
}

/** 3700 s → «1 soat 2 daq», 540 s → «9 daq». */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} daq`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} soat ${m} daq` : `${h} soat`;
}
