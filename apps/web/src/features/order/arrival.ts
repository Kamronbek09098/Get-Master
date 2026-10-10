import { useEffect, useState } from 'react';
import { distanceM } from '@/features/navigation/geometry';
import type { LatLon } from '@/features/navigation/geometry';
import { useLiveLocation } from '@/features/navigation/useLiveLocation';

/** Usta «Yetib keldim» ni faqat mijoz manzilidan shuncha metr ichida bosa oladi (server ham tekshiradi). */
export const ARRIVE_RADIUS_M = 60;

/** GPS nuqtasi shundan eski bo‘lsa, joylashuv «hozirgi» hisoblanmaydi. */
export const FIX_MAX_AGE_MS = 20_000;

export type ArrivalState = 'idle' | 'locating' | 'denied' | 'unavailable' | 'far' | 'near';

export interface ArrivalCheck {
  state: ArrivalState;
  distanceM: number | null;
  /** Serverga yuboriladigan joylashuv. */
  coords: { latitude: number; longitude: number; accuracy: number; fixedAt: number } | null;
  retry: () => void;
}

/**
 * Ustaning joylashuvi (GPS ruxsati so‘raladi) mijoz manziliga qanchalik yaqinligini hisoblaydi.
 * `dest` bo‘lmasa (manzil koordinatasiz yoki mijoz ustaning oldiga boradi) — tekshirilmaydi.
 */
export function useArrivalCheck(dest: LatLon | null, enabled: boolean): ArrivalCheck {
  const live = useLiveLocation(enabled && !!dest);
  // GPS to‘xtab qolsa ham eskirgan nuqta vaqt o‘tishi bilan «hozirgi» bo‘lib qolmasin.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!enabled || !dest) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 4_000);
    return () => window.clearInterval(timer);
  }, [enabled, dest]);
  const position = live.position;
  if (!enabled || !dest) return { state: 'idle', distanceM: null, coords: null, retry: live.retry };
  if (!position || Date.now() - position.at > FIX_MAX_AGE_MS) {
    const blocked = live.status === 'denied' || live.status === 'insecure';
    const broken = live.status === 'unavailable' || live.status === 'timeout';
    return { state: blocked ? 'denied' : broken ? 'unavailable' : 'locating', distanceM: null, coords: null, retry: live.retry };
  }
  const meters = distanceM({ lat: position.lat, lon: position.lon }, dest);
  const near = meters - Math.min(position.accuracy, 30) <= ARRIVE_RADIUS_M;
  return { state: near ? 'near' : 'far', distanceM: Math.round(meters), coords: { latitude: position.lat, longitude: position.lon, accuracy: Math.round(position.accuracy), fixedAt: position.at }, retry: live.retry };
}
