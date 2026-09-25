import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { getThemeMode, setThemeMode, watchSystemTheme } from '@/lib/theme';
import type { ThemeMode } from '@/lib/theme';

const NEXT: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<ThemeMode, string> = { system: 'Tizim mavzusi', light: 'Yorug‘ mavzu', dark: 'Qorong‘i mavzu' };
const ICON = { system: Monitor, light: Sun, dark: Moon } as const;

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(getThemeMode);
  useEffect(() => watchSystemTheme(), []);

  const Icon = ICON[mode];
  return (
    <button
      type="button"
      className="gm-icon-button"
      aria-label={`${LABEL[mode]}. Almashtirish uchun bosing`}
      title={LABEL[mode]}
      onClick={() => {
        const next = NEXT[mode];
        setThemeMode(next);
        setMode(next);
      }}
    >
      <Icon size={19} strokeWidth={2} />
    </button>
  );
}
