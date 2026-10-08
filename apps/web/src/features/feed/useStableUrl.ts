import { useRef } from 'react';

/**
 * Imzolangan havolalar har so‘rovda yangilanadi; video/rasm qayta yuklanib, ijro boshiga qaytmasligi uchun
 * birinchi olingan havola shu komponent yashagunicha saqlanadi (muddati tugasa — yangisi olinadi).
 */
export function useStableUrl(url: string | null | undefined, ttlMs = 8 * 60_000): string | null {
  const kept = useRef<{ url: string; at: number } | null>(null);
  if (!url) return kept.current?.url ?? null;
  if (!kept.current || Date.now() - kept.current.at > ttlMs) kept.current = { url, at: Date.now() };
  return kept.current.url;
}
