/** 1 234 → «1,2K», 1 250 000 → «1,3M». */
export function compact(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0).replace('.', ',').replace(',0', '')}K`;
  return `${(value / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')}M`;
}

/** 75 → «1:15». */
export function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((part) => /^\p{L}/u.test(part))
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '#';

/** Ulashish havolasi: shu ilova ichidagi lenta, post bilan. */
export const postLink = (id: string, base = '/mijoz') => `${window.location.origin}${base}/lenta?post=${id}`;
export const POST_LINK = /\/(?:mijoz|usta)\/lenta\?post=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
