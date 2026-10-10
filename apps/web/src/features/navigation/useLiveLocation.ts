import { useCallback, useEffect, useRef, useState } from 'react';
import { bearing, distanceM } from './geometry';
import type { LatLon } from './geometry';

export type LocationStatus = 'idle' | 'locating' | 'ok' | 'denied' | 'unavailable' | 'timeout' | 'insecure';

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

  const received = useRef(false);

  /**
   * Joylashuvni ishonchli olish: avval tezkor (Wi‑Fi/tarmoq) joylashuv — birinchi nuqta darhol chiqadi; so‘ng aniq GPS kuzatuvi.
   * Kompyuterda GPS yo‘q, shuning uchun yuqori aniqlik xato bersa, past aniqlikdagi kuzatuvga o‘tiladi — faqat ikkalasi ham ishlamasa xato ko‘rsatiladi.
   */
  const start = useCallback(() => {
    stop();
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setStatus('insecure');
      return;
    }
    if (!navigator.geolocation) {
      setStatus('unavailable');
      return;
    }
    received.current = false;
    setStatus('locating');
    const onFix = (p: GeolocationPosition) => {
      received.current = true;
      accept(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.coords.heading, p.coords.speed);
    };
    const fail = (error: GeolocationPositionError, final: boolean) => {
      if (error.code === error.PERMISSION_DENIED) {
        setStatus('denied');
        return true;
      }
      if (received.current) return false; // nuqta bor — vaqtinchalik xatoni e’tiborsiz qoldiramiz
      if (final) setStatus(error.code === error.TIMEOUT ? 'timeout' : 'unavailable');
      return false;
    };
    const watchWith = (high: boolean) => {
      watch.current = navigator.geolocation.watchPosition(
        onFix,
        (error) => {
          if (fail(error, !high)) return;
          if (high && !received.current) {
            // Yuqori aniqlik (GPS) ishlamadi — past aniqlikdagi (tarmoq) kuzatuvga o‘tamiz.
            if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
            watchWith(false);
          }
        },
        { enableHighAccuracy: high, maximumAge: high ? 1000 : 30_000, timeout: high ? 15_000 : 30_000 },
      );
    };
    // Tezkor birinchi nuqta (brauzer ruxsat so‘rovi ham shu yerda chiqadi).
    navigator.geolocation.getCurrentPosition(onFix, (error) => void fail(error, false), { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 });
    watchWith(true);
  }, [accept, stop]);

  useEffect(() => {
    if (!enabled || sim) return;
    start();
    // Foydalanuvchi sozlamalarda ruxsat bersa, avtomatik qayta urinamiz.
    let permission: PermissionStatus | null = null;
    const onChange = () => {
      if (permission?.state === 'granted') start();
    };
    void navigator.permissions
      ?.query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        permission = status;
        status.addEventListener('change', onChange);
      })
      .catch(() => undefined);
    return () => {
      permission?.removeEventListener('change', onChange);
      stop();
    };
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
