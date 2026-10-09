import { t } from '@/i18n';
import type { Maneuver } from './geometry';

/** Burilish matni (ekranda va ovozli aytish uchun). */
export function maneuverText(m: Maneuver, street: string): string {
  const on = street ? ` — ${street}` : '';
  switch (m) {
    case 'left':
      return t('Chapga buriling') + on;
    case 'right':
      return t('O‘ngga buriling') + on;
    case 'slight-left':
      return t('Biroz chapga oling') + on;
    case 'slight-right':
      return t('Biroz o‘ngga oling') + on;
    case 'sharp-left':
      return t('Keskin chapga buriling') + on;
    case 'sharp-right':
      return t('Keskin o‘ngga buriling') + on;
    case 'uturn':
      return t('Qayrilib oling');
    case 'roundabout':
      return t('Aylanma yo‘lga kiring') + on;
    case 'arrive':
      return t('Manzilga yetib keldingiz');
    case 'depart':
      return t('Yo‘lni boshlang') + on;
    default:
      return t('To‘g‘ri davom eting') + on;
  }
}
