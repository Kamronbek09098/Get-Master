import { useCallback, useEffect, useRef, useState } from 'react';

type IOSOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
type IOSOrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

const norm = (deg: number) => ((deg % 360) + 360) % 360;

/**
 * Qurilma kompasi: telefon qayerga qarab tursa, o‘sha yo‘nalish (0–360°, shimoldan soat yo‘nalishida).
 * Android — `deviceorientationabsolute`, iOS — `webkitCompassHeading` (ruxsat foydalanuvchi bosishidan keyin so‘raladi).
 * Qiymat silliqlanadi (aylana bo‘yicha o‘rtacha), ekran burilishi hisobga olinadi.
 */
export function useDeviceHeading(enabled: boolean) {
  const [heading, setHeading] = useState<number | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const smooth = useRef<number | null>(null);
  const lastEmit = useRef(0);
  const started = useRef(false);

  const handle = useCallback((event: Event) => {
    const e = event as IOSOrientationEvent;
    let value: number | null = null;
    if (typeof e.webkitCompassHeading === 'number') value = e.webkitCompassHeading;
    else if (e.absolute === true && typeof e.alpha === 'number') value = 360 - e.alpha;
    else if (event.type === 'deviceorientationabsolute' && typeof e.alpha === 'number') value = 360 - e.alpha;
    if (value == null || Number.isNaN(value)) return;
    value = norm(value + (screen.orientation?.angle ?? 0));
    // Aylana bo‘yicha past chastotali filtr: 350° → 10° sakramasin
    const prev = smooth.current;
    smooth.current = prev == null ? value : norm(prev + (((value - prev + 540) % 360) - 180) * 0.25);
    const now = performance.now();
    if (now - lastEmit.current > 100) {
      lastEmit.current = now;
      setHeading(Math.round(smooth.current));
    }
  }, []);

  const listen = useCallback(() => {
    if (started.current) return;
    started.current = true;
    window.addEventListener('deviceorientationabsolute', handle as EventListener, true);
    window.addEventListener('deviceorientation', handle as EventListener, true);
  }, [handle]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
    const ctor = window.DeviceOrientationEvent as IOSOrientationCtor;
    if (typeof ctor.requestPermission === 'function') setNeedsPermission(true);
    else listen();
    return () => {
      started.current = false;
      window.removeEventListener('deviceorientationabsolute', handle as EventListener, true);
      window.removeEventListener('deviceorientation', handle as EventListener, true);
    };
  }, [enabled, listen, handle]);

  /** iOS: kompas ruxsatini foydalanuvchi bosishi ichida so‘raydi. */
  const request = useCallback(() => {
    const ctor = window.DeviceOrientationEvent as IOSOrientationCtor;
    if (typeof ctor?.requestPermission !== 'function') return;
    void ctor.requestPermission().then((state) => {
      if (state === 'granted') {
        setNeedsPermission(false);
        listen();
      }
    }).catch(() => undefined);
  }, [listen]);

  return { heading, needsPermission, request };
}
