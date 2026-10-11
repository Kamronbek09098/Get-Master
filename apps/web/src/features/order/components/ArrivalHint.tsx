import { LocateFixed, MapPinOff } from 'lucide-react';
import type { ArrivalCheck } from '@/features/order/arrival';
import { openGpsSettings } from '@/features/navigation/device-gps';
import { formatDistance } from '@/features/navigation/geometry';
import { t } from '@/i18n';

/** «Yetib keldim» tugmasi ostidagi holat: GPS ruxsati, masofa. Tugma faqat `state === 'near'` bo‘lganda faol. */
export function ArrivalHint({ check }: { check: ArrivalCheck }) {
  if (check.state === 'idle' || check.state === 'near') return check.state === 'near' ? <p className="gm-arrive gm-arrive--ok"><LocateFixed size={14} aria-hidden="true" /> {t('Siz manzildasiz — yetib kelganingizni belgilashingiz mumkin.')}</p> : null;
  if (check.state === 'locating') return <p className="gm-arrive">{t('Joylashuvingiz aniqlanmoqda…')}</p>;
  if (check.state === 'far') return <p className="gm-arrive">{t('Manzilgacha taxminan {distance} qoldi. Manzilga yetib borgach tugma faollashadi.', { distance: formatDistance(check.distanceM ?? 0) })}</p>;
  if (check.state === 'gpsoff')
    return (
      <p className="gm-arrive gm-arrive--warn" role="alert">
        <MapPinOff size={14} aria-hidden="true" /> {t('Qurilmada GPS (joylashuv) o‘chiq. Yetib kelganingizni belgilash uchun uni yoqing.')}{' '}
        <button type="button" className="gm-arrive__retry" onClick={() => void openGpsSettings()}>{t('GPS ni yoqish')}</button>
      </p>
    );
  return (
    <p className="gm-arrive gm-arrive--warn" role="alert">
      <MapPinOff size={14} aria-hidden="true" />{' '}
      {check.state === 'denied' ? t('Yetib kelganingizni belgilash uchun joylashuvga (GPS) ruxsat bering.') : t('Joylashuvni aniqlab bo‘lmadi. GPS yoqilganini tekshiring.')}{' '}
      <button type="button" className="gm-arrive__retry" onClick={check.retry}>{check.state === 'denied' ? t('Ruxsat berish') : t('Qayta urinish')}</button>
    </p>
  );
}
