import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { getThemeMode, setThemeMode } from '@/lib/theme';
import type { ThemeMode } from '@/lib/theme';

const NEXT: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'light' };
const LABEL: Record<ThemeMode, string> = { light: 'Yorug‘ mavzu', dark: 'Qorong‘i mavzu' };
const ICON = { light: Sun, dark: Moon } as const;

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(getThemeMode);

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
