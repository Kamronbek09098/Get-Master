import { t } from '@/i18n';

export interface PreciseFix {
  latitude: number;
  longitude: number;
  /** Aniqlik (metr): qanchalik kichik bo‘lsa, shunchalik yaxshi. */
  accuracy: number;
}

export type LocationFailure = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

export class LocationError extends Error {
  constructor(readonly reason: LocationFailure) {
    super(reason);
  }
}

/** Shu aniqlikka (metr) yetilsa, kutish to‘xtatiladi. */
const GOOD_ENOUGH = 25;
/** Bundan yomon bo‘lsa, foydalanuvchiga «aniq emas» deb ko‘rsatiladi. */
export const WEAK_ACCURACY = 100;

export function locationErrorText(error: unknown): string {
  const reason = error instanceof LocationError ? error.reason : 'unavailable';
  switch (reason) {
    case 'unsupported':
      return t('Bu qurilmada joylashuvni aniqlab bo‘lmaydi.');
    case 'denied':
      return t('Joylashuvga ruxsat berilmadi. Brauzer yoki telefon sozlamalaridan GetMaster uchun «Joylashuv»ni yoqing.');
    case 'timeout':
      return t('Joylashuv aniqlanmadi. GPS yoqilganini tekshirib, ochiq joyda qayta urinib ko‘ring.');
    default:
      return t('Joylashuvni aniqlab bo‘lmadi. GPS yoqilganini tekshiring.');
  }
}

export function accuracyText(accuracy: number): string {
  return t('Aniqlik: ±{meters} m', { meters: Math.max(1, Math.round(accuracy)) });
}

/** Joylashuvga ruxsat holati (brauzer qo‘llasa). */
export async function locationPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    return status ? status.state : 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Qurilmaning eng aniq joylashuvini oladi: ruxsat so‘raydi, GPS (yuqori aniqlik) bilan bir necha o‘lchov yig‘adi
 * va eng aniqini qaytaradi. Keshdagi eski joylashuvdan foydalanilmaydi.
 */
export function getPreciseLocation(options: { timeoutMs?: number; onProgress?: (fix: PreciseFix) => void } = {}): Promise<PreciseFix> {
  const { timeoutMs = 15_000, onProgress } = options;
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new LocationError('unsupported'));
      return;
    }
    let best: PreciseFix | null = null;
    let settled = false;
    let watchId = -1;
    let timer = 0;

    const finish = (fix: PreciseFix | null, failure?: LocationFailure) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      window.clearTimeout(timer);
      if (fix) resolve(fix);
      else reject(new LocationError(failure ?? 'unavailable'));
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const fix: PreciseFix = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy };
        if (!best || fix.accuracy < best.accuracy) best = fix;
        onProgress?.(best);
        if (best.accuracy <= GOOD_ENOUGH) finish(best);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) finish(null, 'denied');
        else if (best) finish(best);
        else finish(null, error.code === error.TIMEOUT ? 'timeout' : 'unavailable');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    );
    timer = window.setTimeout(() => finish(best, 'timeout'), timeoutMs);
  });
}
