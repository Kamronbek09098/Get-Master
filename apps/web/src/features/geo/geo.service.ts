import { apiGet } from '@/services/api.client';

export interface GeoPlace {
  title: string;
  subtitle: string;
  addressLine: string;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  uri?: string;
}

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value));
  return search.toString();
};

export const geoService = {
  /** source='local' — serverdagi xotira indeksi (bir zumda); aks holda Yandex/OSM (sekinroq, to‘liqroq). */
  suggest(q: string, near?: { lat: number; lon: number }, source?: 'local') {
    return apiGet<{ provider: string; items: GeoPlace[] }>(`/geo/suggest?${query({ q, lat: near?.lat, lon: near?.lon, source })}`);
  },
  geocode(input: { q?: string; uri?: string }) {
    return apiGet<{ provider: string; place: GeoPlace | null }>(`/geo/geocode?${query(input)}`);
  },
  reverse(lat: number, lon: number) {
    return apiGet<{ provider: string; place: GeoPlace | null }>(`/geo/reverse?${query({ lat, lon })}`);
  },
};
