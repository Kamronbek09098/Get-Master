import { existsSync, readFileSync } from 'node:fs';

/** Qidiruv natijasi (GeoService.GeoPlace bilan mos). */
export interface IndexedPlace {
  title: string;
  subtitle: string;
  addressLine: string;
  city: string | null;
  district: string | null;
  latitude: number;
  longitude: number;
}

interface IndexFile {
  strings: string[];
  /** [nom, muqobil nomlar, muhimlik, lat, lon, shahar id, tuman id] */
  rows: Array<[string, string, number, number, number, number, number]>;
}

const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'x', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

const POOL = 300;
const WORD = /[\p{L}\p{N}]+/gu;

/** Kichik harf, apostrof/diakritiksiz, kirill → lotin. */
export function normalize(value: string): string {
  const lower = value.toLowerCase().replace(/[ʻʼ'’`‘´]/g, '');
  let out = '';
  for (const ch of lower) out += CYRILLIC[ch] ?? ch;
  return out.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const words = (value: string): string[] => value.match(WORD) ?? [];

/**
 * Xotiradagi manzillar indeksi (OSM, O‘zbekiston). Prefiks bo‘yicha qidiruv millisekundlarda bajariladi.
 * Fayl `scripts/build-geo-index.py` bilan yaratiladi.
 */
export class GeoIndex {
  private names: string[] = [];
  private keys: string[] = [];
  private rank = new Uint8Array(0);
  private lat = new Float64Array(0);
  private lon = new Float64Array(0);
  private cityIds = new Uint32Array(0);
  private districtIds = new Uint32Array(0);
  private strings: string[] = [];
  private tokens: string[] = [];
  private postings = new Map<string, number[]>();
  private readonly prefixCache = new Map<string, number[]>();

  get size(): number {
    return this.names.length;
  }

  load(path: string): boolean {
    if (!existsSync(path)) return false;
    const data = JSON.parse(readFileSync(path, 'utf8')) as IndexFile;
    const count = data.rows.length;
    this.strings = data.strings;
    this.names = new Array<string>(count);
    this.keys = new Array<string>(count);
    this.rank = new Uint8Array(count);
    this.lat = new Float64Array(count);
    this.lon = new Float64Array(count);
    this.cityIds = new Uint32Array(count);
    this.districtIds = new Uint32Array(count);
    const postings = new Map<string, number[]>();
    data.rows.forEach(([name, alt, rank, lat, lon, city, district], id) => {
      this.names[id] = name;
      this.rank[id] = rank;
      this.lat[id] = lat;
      this.lon[id] = lon;
      this.cityIds[id] = city;
      this.districtIds[id] = district;
      const list = words(normalize(alt ? `${name} ${alt}` : name));
      const unique = Array.from(new Set(list));
      this.keys[id] = ` ${unique.join(' ')}`;
      for (const token of unique) {
        const posting = postings.get(token);
        if (posting) posting.push(id);
        else postings.set(token, [id]);
      }
    });
    // Har bir token ro‘yxati muhimlik bo‘yicha kamayish tartibida: eng yaxshi natijalar boshida.
    for (const posting of postings.values()) posting.sort((a, b) => this.rank[b] - this.rank[a]);
    this.postings = postings;
    this.tokens = Array.from(postings.keys()).sort();
    this.prefixCache.clear();
    return true;
  }

  /** Qisqa prefikslarni (1 ta belgi) oldindan hisoblab qo‘yadi. */
  warmUp(): void {
    for (const ch of 'abcdefghijklmnopqrstuvwxyz0123456789') this.candidates(ch);
  }

  private lowerBound(prefix: string): number {
    let lo = 0;
    let hi = this.tokens.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.tokens[mid] < prefix) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** Prefiksga mos tokenlar bo‘yicha eng muhim POOL ta yozuv. */
  private candidates(prefix: string): number[] {
    const hit = this.prefixCache.get(prefix);
    if (hit) return hit;
    const seen = new Set<number>();
    for (let i = this.lowerBound(prefix); i < this.tokens.length && this.tokens[i].startsWith(prefix); i += 1) {
      const posting = this.postings.get(this.tokens[i]) as number[];
      const limit = Math.min(posting.length, POOL);
      for (let j = 0; j < limit; j += 1) seen.add(posting[j]);
    }
    const ids = Array.from(seen).sort((a, b) => this.rank[b] - this.rank[a]).slice(0, POOL);
    if (this.prefixCache.size < 20_000) this.prefixCache.set(prefix, ids);
    return ids;
  }

  search(query: string, near?: { lat: number; lon: number }, limit = 10): IndexedPlace[] {
    const normalized = normalize(query).trim();
    const parts = words(normalized);
    if (parts.length === 0 || this.size === 0) return [];
    const lead = parts.reduce((best, part) => (part.length > best.length ? part : best), '');
    const rest = parts.filter((_, index) => index !== parts.indexOf(lead));
    const phrase = parts.join(' ');
    const scored: Array<{ id: number; score: number }> = [];
    for (const id of this.candidates(lead)) {
      const key = this.keys[id];
      if (!rest.every((part) => key.includes(` ${part}`))) continue;
      let score = this.rank[id];
      const first = key.slice(1, 1 + phrase.length);
      if (first === phrase) score += 40;
      else if (key.includes(` ${phrase}`)) score += 20;
      if (key.includes(` ${lead} `) || key.endsWith(` ${lead}`)) score += 8;
      if (near) {
        const dy = this.lat[id] - near.lat;
        const dx = (this.lon[id] - near.lon) * Math.cos((near.lat * Math.PI) / 180);
        const km = Math.sqrt(dy * dy + dx * dx) * 111;
        score += km < 5 ? 40 : km < 30 ? 25 : km < 100 ? 10 : 0;
      }
      scored.push({ id, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(({ id }) => this.toPlace(id));
  }

  private toPlace(id: number): IndexedPlace {
    const city = this.strings[this.cityIds[id]] || null;
    const district = this.strings[this.districtIds[id]] || null;
    const name = this.names[id];
    const subtitle = [district, city].filter(Boolean).join(', ');
    return {
      title: name,
      subtitle,
      addressLine: [name, district, city].filter(Boolean).join(', '),
      city,
      district,
      latitude: this.lat[id],
      longitude: this.lon[id],
    };
  }
}
