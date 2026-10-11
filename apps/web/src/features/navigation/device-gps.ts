import { Capacitor, registerPlugin } from '@capacitor/core';

interface DeviceLocationPlugin {
  isEnabled(): Promise<{ enabled: boolean }>;
  openSettings(): Promise<void>;
}

const Native = registerPlugin<DeviceLocationPlugin>('DeviceLocation');

/** Telefon ilovasi (Capacitor) ichidami — shu holatda qurilma GPS xizmati yoqilganini tekshira olamiz. */
export const isNativeApp = (): boolean => typeof window !== 'undefined' && Capacitor.isNativePlatform();

/** Qurilmaning joylashuv xizmati (GPS) yoqilganmi. Brauzerda yoki aniqlab bo‘lmasa — true (brauzer o‘zi so‘raydi). */
export async function isDeviceGpsOn(): Promise<boolean> {
  if (!isNativeApp()) return true;
  try {
    return (await Native.isEnabled()).enabled;
  } catch {
    return true;
  }
}

/** Telefonning «Joylashuv» sozlamalarini ochadi (foydalanuvchi GPS'ni yoqadi). */
export async function openGpsSettings(): Promise<void> {
  try {
    await Native.openSettings();
  } catch {
    /* sozlamalarni ochib bo‘lmadi — foydalanuvchi qo‘lda yoqadi */
  }
}
