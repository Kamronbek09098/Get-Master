import { useCallback, useState } from 'react';

export type SoundMode = 'off' | 'important' | 'all';
export type VolumeLevel = 'low' | 'mid' | 'high';
export type MapTheme = 'auto' | 'light' | 'dark';

export interface NavSettings {
  sound: SoundMode;
  volume: VolumeLevel;
  mapTheme: MapTheme;
  showSpeed: boolean;
  keepAwake: boolean;
  headingUp: boolean;
}

export const VOLUME_GAIN: Record<VolumeLevel, number> = { low: 0.35, mid: 0.7, high: 1 };
const KEY = 'gm.nav.settings';
const DEFAULTS: NavSettings = { sound: 'all', volume: 'mid', mapTheme: 'auto', showSpeed: true, keepAwake: true, headingUp: true };

function read(): NavSettings {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<NavSettings>;
    return {
      sound: ['off', 'important', 'all'].includes(parsed.sound as string) ? (parsed.sound as SoundMode) : DEFAULTS.sound,
      volume: ['low', 'mid', 'high'].includes(parsed.volume as string) ? (parsed.volume as VolumeLevel) : DEFAULTS.volume,
      mapTheme: ['auto', 'light', 'dark'].includes(parsed.mapTheme as string) ? (parsed.mapTheme as MapTheme) : DEFAULTS.mapTheme,
      showSpeed: typeof parsed.showSpeed === 'boolean' ? parsed.showSpeed : DEFAULTS.showSpeed,
      keepAwake: typeof parsed.keepAwake === 'boolean' ? parsed.keepAwake : DEFAULTS.keepAwake,
      headingUp: typeof parsed.headingUp === 'boolean' ? parsed.headingUp : DEFAULTS.headingUp,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Navigatsiya sozlamalari: qurilmada saqlanadi (ovoz rejimi, balandlik, xarita mavzusi va h.k.). */
export function useNavSettings(): [NavSettings, (patch: Partial<NavSettings>) => void] {
  const [settings, setSettings] = useState<NavSettings>(read);
  const update = useCallback((patch: Partial<NavSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* xotira yopiq bo‘lsa ham ishlayveradi */
      }
      return next;
    });
  }, []);
  return [settings, update];
}
