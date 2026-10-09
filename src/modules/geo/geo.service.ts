import { join } from 'node:path';
import https from 'node:https';
import { BadRequestException, Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { GeoIndex } from './geo-index';
import { CircuitBreaker, CircuitBreakerOpenError } from '../../common/utils/circuit-breaker';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';

export interface GeoPlace {
  /** Ro‘yxatda ko‘rinadigan sarlavha (masalan, «Amir Temur ko‘chasi 15»). */
  title: string;
  /** Qo‘shimcha qism (shahar, tuman). */
  subtitle: string;
  /** Manzil maydoniga yoziladigan to‘liq matn. */
  addressLine: string;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Yandex Suggest natijasini keyin koordinatga aylantirish uchun. */
  uri?: string;
}

const CACHE_TTL_MS = 600_000;
const CACHE_MAX = 2000;
const UZ_VIEWBOX = '55.9,45.6,73.2,37.1'; // Nominatim: O‘zbekiston atrofi (left,top,right,bottom)
const UA = 'GetMaster/1.0 (address-picker)';

export interface GeoRouteStep {
  type: string;
  modifier: string | null;
  name: string;
  distanceM: number;
  durationS: number;
  /** [lon, lat] — burilish nuqtasi. */
  location: [number, number];
}

export interface GeoRoute {
  distanceM: number;
  durationS: number;
  /** [lon, lat] nuqtalar ketma-ketligi. */
  geometry: Array<[number, number]>;
  steps: GeoRouteStep[];
}

interface OsrmResponse {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: Array<[number, number]> };
    legs: Array<{ steps: Array<{ name: string; distance: number; duration: number; maneuver: { type: string; modifier?: string; location: [number, number] } }> }>;
  }>;
}

type Cached = { at: number; value: unknown };

/**
 * Real manzillar: Yandex Geocoder/Suggest kalitlari (YANDEX_GEOCODER_API_KEY, YANDEX_SUGGEST_API_KEY) berilsa Yandex,
 * aks holda OpenStreetMap Nominatim ishlatiladi. Kalitlar faqat serverda saqlanadi.
 */
@Injectable()
export class GeoService implements OnModuleInit {
  private readonly logger = new Logger(GeoService.name);
  private readonly geocoderBreaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30_000 });
  private readonly osrmBreaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 20_000 });

  constructor(private readonly metrics: MetricsService) {
    metrics.registerBreaker('geocoder', this.geocoderBreaker);
    metrics.registerBreaker('osrm', this.osrmBreaker);
  }

  /** Tashqi chaqiruvni breaker va metrikalar bilan o‘raydi; breaker ochiq bo‘lsa, 503 qaytaradi. */
  private async guarded<T>(provider: string, breaker: CircuitBreaker, message: string, call: () => Promise<T>): Promise<T> {
    const stat = this.stats[provider]!;
    try {
      const value = await breaker.execute(call);
      this.metrics.providerCall(provider, 'success');
      stat.success += 1;
      stat.lastOkAt = new Date().toISOString();
      return value;
    } catch (error) {
      if (error instanceof CircuitBreakerOpenError) {
        this.metrics.providerCall(provider, 'circuit_open');
        stat.circuitOpen += 1;
        throw new ServiceUnavailableException(message);
      }
      this.metrics.providerCall(provider, 'failure');
      stat.failure += 1;
      stat.lastFailureAt = new Date().toISOString();
      stat.lastError = String(error instanceof Error ? error.message : error).slice(0, 200);
      throw error;
    }
  }

  private readonly stats: Record<string, ProviderStat> = {
    geocoder: { success: 0, failure: 0, circuitOpen: 0, lastOkAt: null, lastFailureAt: null, lastError: null },
    osrm: { success: 0, failure: 0, circuitOpen: 0, lastOkAt: null, lastFailureAt: null, lastError: null },
  };

  /** Admin «DevOps» sahifasi uchun: tashqi xarita xizmatlarining holati (jarayon ishga tushgandan beri). */
  health(): Array<{ key: string; label: string; provider: string; state: string } & ProviderStat> {
    const provider = this.provider();
    return [
      { key: 'geocoder', label: 'Manzil qidiruvi (geokoder)', provider: provider.geocoder, state: this.geocoderBreaker.getState(), ...this.stats.geocoder! },
      { key: 'osrm', label: 'Marshrut serveri (OSRM)', provider: 'osrm', state: this.osrmBreaker.getState(), ...this.stats.osrm! },
    ];
  }
  private readonly cache = new Map<string, Cached>();
  private readonly index = new GeoIndex();

  onModuleInit(): void {
    const path = process.env.GEO_INDEX_PATH?.trim() || join(process.cwd(), 'data', 'geo-uz.json');
    const started = Date.now();
    if (this.index.load(path)) {
      this.logger.log(`Manzillar indeksi yuklandi: ${this.index.size} ta yozuv (${Date.now() - started} ms).`);
      setImmediate(() => this.index.warmUp());
    } else {
      this.logger.warn(`Manzillar indeksi topilmadi (${path}) — qidiruv faqat tashqi xizmat orqali (sekinroq). scripts/build-geo-index.py bilan yarating.`);
    }
    // Birinchi qidiruv ham tez bo‘lishi uchun ulanishni oldindan ochamiz.
    if (this.suggestKey) void this.suggest('a').catch(() => undefined);
  }

  private get geocoderKey() {
    return process.env.YANDEX_GEOCODER_API_KEY?.trim() || '';
  }

  private get suggestKey() {
    return process.env.YANDEX_SUGGEST_API_KEY?.trim() || '';
  }

  private get lang() {
    return process.env.YANDEX_LANG?.trim() || 'uz_UZ';
  }

  provider() {
    return { geocoder: this.geocoderKey ? 'yandex' : 'osm', suggest: this.suggestKey ? 'yandex' : 'osm' };
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
    const value = await load();
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string);
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  /** Doimiy (keep-alive) ulanish: har so‘rovda TLS qo‘l siqishuvi (0,2–0,5 s) takrorlanmaydi. */
  private readonly agent = new https.Agent({ keepAlive: true, keepAliveMsecs: 30_000, maxSockets: 16 });

  private requestJson(url: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { agent: this.agent, headers: { 'User-Agent': UA, Accept: 'application/json', ...headers }, timeout: 8000 }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
        res.on('error', reject);
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', reject);
    });
  }

  private fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
    return this.guarded('geocoder', this.geocoderBreaker, 'Xarita xizmati vaqtincha ishlamayapti', () => this.fetchJsonRaw(url, headers));
  }

  private async fetchJsonRaw(url: string, headers: Record<string, string>): Promise<unknown> {
    let result: { status: number; body: string } | undefined;
    for (let attempt = 1; attempt <= 2 && !result; attempt += 1) {
      try {
        result = await this.requestJson(url, headers);
      } catch (error) {
        this.logger.warn(`Geo so‘rovi bajarilmadi (${attempt}-urinish): ${String(error)}`);
        if (attempt === 2) throw new ServiceUnavailableException('Xarita xizmatiga ulanib bo‘lmadi');
      }
    }
    if (!result || result.status < 200 || result.status >= 300) {
      this.logger.warn(`Geo xizmati ${result?.status ?? 0} qaytardi`);
      throw new ServiceUnavailableException('Xarita xizmati vaqtincha ishlamayapti');
    }
    return JSON.parse(result.body);
  }

  /** Xotiradagi indeks: millisekundlarda. Indeks bo‘lmasa bo‘sh ro‘yxat. */
  suggestLocal(query: string, lat?: number, lon?: number): GeoPlace[] {
    const text = query.trim().slice(0, 200);
    if (!text) return [];
    const near = lat !== undefined && lon !== undefined ? { lat, lon } : undefined;
    return this.index.search(text, near, 10);
  }

  async suggest(query: string, lat?: number, lon?: number): Promise<GeoPlace[]> {
    const text = query.trim();
    if (text.length < 1) return [];
    if (text.length > 200) throw new BadRequestException('Qidiruv matni juda uzun');
    return this.cached(`s:${text.toLowerCase()}:${lat?.toFixed(2)}:${lon?.toFixed(2)}:${this.suggestKey ? 'y' : 'o'}`, () =>
      this.suggestKey ? this.yandexSuggest(text, lat, lon) : this.osmSearch(text, 6),
    );
  }

  /** Matn yoki Yandex `uri` bo‘yicha koordinatli manzil. */
  async geocode(query?: string, uri?: string): Promise<GeoPlace | null> {
    const text = (query ?? '').trim();
    if (!text && !uri) throw new BadRequestException('Manzil ko‘rsatilmagan');
    return this.cached(`g:${uri ?? text.toLowerCase()}:${this.geocoderKey ? 'y' : 'o'}`, async () => {
      if (this.geocoderKey) return (await this.yandexGeocode(uri ? { uri } : { geocode: text }))[0] ?? null;
      return (await this.osmSearch(text, 1))[0] ?? null;
    });
  }

  async reverse(lat: number, lon: number): Promise<GeoPlace | null> {
    return this.cached(`r:${lat.toFixed(5)}:${lon.toFixed(5)}:${this.geocoderKey ? 'y' : 'o'}`, async () => {
      if (this.geocoderKey) return (await this.yandexGeocode({ geocode: `${lon},${lat}`, sco: 'longlat', kind: 'house' }))[0] ?? null;
      return this.osmReverse(lat, lon);
    });
  }

  // ---------------- Yandex ----------------

  private async yandexSuggest(text: string, lat?: number, lon?: number): Promise<GeoPlace[]> {
    const params = new URLSearchParams({ apikey: this.suggestKey, text, lang: this.lang, results: '10', types: 'geo,street,house', print_address: '1' });
    if (lat !== undefined && lon !== undefined) {
      params.set('ll', `${lon},${lat}`);
      params.set('spn', '1.0,1.0');
    } else {
      params.set('ll', '69.2401,41.2995'); // Toshkent atrofidagi natijalarni birinchi qo‘yish
      params.set('spn', '3.0,3.0');
    }
    const data = (await this.fetchJson(`https://suggest-maps.yandex.ru/v1/suggest?${params}`)) as {
      results?: Array<{ title?: { text?: string }; subtitle?: { text?: string }; address?: { formatted_address?: string }; uri?: string }>;
    };
    return (data.results ?? []).map((item) => {
      const title = item.title?.text ?? '';
      const subtitle = item.subtitle?.text ?? '';
      return {
        title,
        subtitle,
        addressLine: item.address?.formatted_address ?? [subtitle, title].filter(Boolean).join(', '),
        city: null,
        district: null,
        latitude: null,
        longitude: null,
        uri: item.uri,
      };
    });
  }

  private async yandexGeocode(input: Record<string, string>): Promise<GeoPlace[]> {
    const params = new URLSearchParams({ apikey: this.geocoderKey, format: 'json', lang: this.lang, results: '1', ...input });
    const data = (await this.fetchJson(`https://geocode-maps.yandex.ru/1.x/?${params}`)) as {
      response?: { GeoObjectCollection?: { featureMember?: Array<{ GeoObject?: YandexGeoObject }> } };
    };
    const members = data.response?.GeoObjectCollection?.featureMember ?? [];
    return members.flatMap((member) => (member.GeoObject ? [this.fromYandex(member.GeoObject)] : []));
  }

  private fromYandex(object: YandexGeoObject): GeoPlace {
    const meta = object.metaDataProperty?.GeocoderMetaData;
    const components = meta?.Address?.Components ?? [];
    const pick = (...kinds: string[]) => components.find((component) => kinds.includes(component.kind))?.name ?? null;
    const [lonText, latText] = (object.Point?.pos ?? '').split(' ');
    const full = meta?.Address?.formatted ?? meta?.text ?? object.name ?? '';
    const street = [pick('street'), pick('house')].filter(Boolean).join(', ');
    return {
      title: object.name ?? street ?? full,
      subtitle: object.description ?? '',
      addressLine: full,
      city: pick('locality', 'province'),
      district: pick('district'),
      latitude: latText ? Number(latText) : null,
      longitude: lonText ? Number(lonText) : null,
    };
  }

  // ---------------- OpenStreetMap (kalit shart emas) ----------------

  private async osmSearch(text: string, limit: number): Promise<GeoPlace[]> {
    const params = new URLSearchParams({
      q: text,
      format: 'jsonv2',
      addressdetails: '1',
      limit: String(limit),
      countrycodes: 'uz',
      viewbox: UZ_VIEWBOX,
      'accept-language': 'uz,ru',
    });
    const rows = (await this.fetchJson(`https://nominatim.openstreetmap.org/search?${params}`)) as OsmRow[];
    return rows.map((row) => this.fromOsm(row));
  }

  private async osmReverse(lat: number, lon: number): Promise<GeoPlace | null> {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon), format: 'jsonv2', addressdetails: '1', zoom: '18', 'accept-language': 'uz,ru' });
    const row = (await this.fetchJson(`https://nominatim.openstreetmap.org/reverse?${params}`)) as OsmRow & { error?: string };
    if (!row || row.error) return null;
    const place = this.fromOsm(row);
    return { ...place, latitude: lat, longitude: lon };
  }

  private fromOsm(row: OsmRow): GeoPlace {
    const a = row.address ?? {};
    const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.state ?? null;
    const district = a.city_district ?? a.suburb ?? a.county ?? a.neighbourhood ?? null;
    const street = [a.road, a.house_number].filter(Boolean).join(' ');
    const name = row.name || street || district || city || row.display_name;
    const line = [street || row.name, district, city].filter(Boolean).join(', ') || row.display_name;
    return {
      title: name,
      subtitle: [district, city].filter(Boolean).join(', '),
      addressLine: line,
      city,
      district,
      latitude: Number(row.lat),
      longitude: Number(row.lon),
    };
  }

  /**
   * Avtomobil marshruti (OSRM): asosiy va muqobil yo‘llar, burilishlar bilan. `OSRM_URL` — marshrut serveri (standart: http://localhost:5001).
   * Server ishlamasa yoki yo‘l topilmasa, 503/400 xato qaytadi (ilova bunda xaritada tashqi navigatsiyani taklif qiladi).
   */
  async route(from: { lat: number; lon: number }, to: { lat: number; lon: number }): Promise<GeoRoute[]> {
    const base = (process.env.OSRM_URL?.trim() || 'http://localhost:5001').replace(/\/$/, '');
    const key = `route:${from.lat.toFixed(4)},${from.lon.toFixed(4)}:${to.lat.toFixed(4)},${to.lon.toFixed(4)}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 60_000) return hit.value as GeoRoute[];
    const url = `${base}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?alternatives=3&steps=true&geometries=geojson&overview=full`;
    let body: OsrmResponse;
    try {
      body = await this.guarded('osrm', this.osrmBreaker, 'Marshrut xizmati hozir ishlamayapti', async () => {
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        return (await response.json()) as OsrmResponse;
      });
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.warn(`Marshrut serveri javob bermadi: ${String(error)}`);
      throw new ServiceUnavailableException('Marshrut xizmati hozir ishlamayapti');
    }
    if (body.code !== 'Ok' || !body.routes?.length) throw new BadRequestException('Bu manzilga avtomobil yo‘li topilmadi');
    const routes: GeoRoute[] = body.routes.slice(0, 3).map((route) => ({
      distanceM: Math.round(route.distance),
      durationS: Math.round(route.duration),
      geometry: route.geometry.coordinates,
      steps: route.legs.flatMap((leg) =>
        leg.steps.map((step) => ({
          type: step.maneuver.type,
          modifier: step.maneuver.modifier ?? null,
          name: step.name || '',
          distanceM: Math.round(step.distance),
          durationS: Math.round(step.duration),
          location: step.maneuver.location,
        })),
      ),
    }));
    this.cache.set(key, { at: Date.now(), value: routes });
    return routes;
  }
}

export interface ProviderStat {
  success: number;
  failure: number;
  circuitOpen: number;
  lastOkAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
}

interface YandexGeoObject {
  name?: string;
  description?: string;
  Point?: { pos?: string };
  metaDataProperty?: {
    GeocoderMetaData?: { text?: string; Address?: { formatted?: string; Components?: Array<{ kind: string; name: string }> } };
  };
}

interface OsmRow {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string>;
}
