import { useCallback, useEffect, useRef, useState } from 'react';
import { bearing, distanceM } from './geometry';
import type { LatLon } from './geometry';

export type LocationStatus = 'idle' | 'locating' | 'ok' | 'denied' | 'unavailable' | 'timeout';

export interface LivePosition extends LatLon {
  accuracy: number;
  /** Harakat yo‘nalishi (0–360°) — GPS yoki oxirgi nuqtalardan hisoblangan; noma’lum bo‘lsa null. */
  heading: number | null;
  speed: number | null;
  at: number;
}

/**
 * Jonli joylashuv (GPS): ruxsat so‘raydi, har soniyada yangilanadi. Telefon ilovasida (Capacitor WebView) va brauzerda ishlaydi.
 * `sim` berilsa — GPS o‘rniga berilgan yo‘l bo‘ylab harakatni taqlid qiladi (demo va sinov uchun).
 */
export function useLiveLocation(enabled: boolean, sim?: Array<[number, number]> | null) {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [position, setPosition] = useState<LivePosition | null>(null);
  const last = useRef<LivePosition | null>(null);
  const watch = useRef<number | null>(null);

  const accept = useCallback((lat: number, lon: number, accuracy: number, rawHeading: number | null, rawSpeed: number | null) => {
    const prev = last.current;
    let heading = rawHeading != null && Number.isFinite(rawHeading) && (rawSpeed ?? 0) > 0.8 ? rawHeading : (prev?.heading ?? null);
    if (prev && distanceM(prev, { lat, lon }) > 8 && (rawHeading == null || !Number.isFinite(rawHeading))) heading = bearing(prev, { lat, lon });
    const next: LivePosition = { lat, lon, accuracy, heading, speed: rawSpeed, at: Date.now() };
    // Juda noaniq (>150 m) nuqtalar e’tiborga olinmaydi, lekin birinchi nuqta doim qabul qilinadi.
    if (!prev || accuracy <= 150) {
      last.current = next;
      setPosition(next);
    }
    setStatus('ok');
  }, []);

  const stop = useCallback(() => {
    if (watch.current != null) navigator.geolocation?.clearWatch(watch.current);
    watch.current = null;
  }, []);

  const start = useCallback(() => {
    stop();
    if (!navigator.geolocation) {
      setStatus('unavailable');
      return;
    }
    setStatus('locating');
    watch.current = navigator.geolocation.watchPosition(
      (p) => accept(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.coords.heading, p.coords.speed),
      (error) => setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : error.code === error.TIMEOUT ? 'timeout' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20_000 },
    );
  }, [accept, stop]);

  useEffect(() => {
    if (!enabled || sim) return;
    start();
    return stop;
  }, [enabled, sim, start, stop]);

  // Taqlid: yo‘lning nuqtalari bo‘ylab ~15× tezlikda yuradi.
  useEffect(() => {
    if (!enabled || !sim || sim.length < 2) return;
    setStatus('locating');
    let i = 0;
    const timer = window.setInterval(() => {
      const [lon, lat] = sim[Math.min(i, sim.length - 1)]!;
      const [nlon, nlat] = sim[Math.min(i + 1, sim.length - 1)]!;
      accept(lat, lon, 6, bearing({ lat, lon }, { lat: nlat, lon: nlon }), 12);
      i = Math.min(i + 1, sim.length - 1);
    }, 700);
    return () => window.clearInterval(timer);
  }, [enabled, sim, accept]);

  return { status, position, retry: start };
}
