export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'getmaster.theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getThemeMode(): ThemeMode {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(mode: ThemeMode): void {
  const dark = mode === 'dark' || (mode === 'system' && media().matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

export function setThemeMode(mode: ThemeMode): void {
  try {
    if (mode === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch {
  }
  applyTheme(mode);
}

export function watchSystemTheme(): () => void {
  const query = media();
  const onChange = () => {
    if (getThemeMode() === 'system') applyTheme('system');
  };
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
