import { toUzbekCyrillic } from './translit';
import { en } from './en';
import { enExtra } from './en.extra';
import { ru } from './ru';
import { ruExtra } from './ru.extra';

export type Lang = 'uz' | 'uz-Cyrl' | 'ru' | 'en';

export const LANGUAGES: Array<{ code: Lang; label: string; short: string }> = [
  { code: 'uz', label: 'O‘zbekcha', short: 'UZ' },
  { code: 'uz-Cyrl', label: 'Ўзбекча', short: 'ЎЗ' },
  { code: 'ru', label: 'Русский', short: 'RU' },
  { code: 'en', label: 'English', short: 'EN' },
];

const KEY = 'getmaster.lang';
const VALID = new Set<string>(LANGUAGES.map((item) => item.code));

function detect(): Lang {
  try {
    // «?lang=ru» — tilni havola orqali tanlash (saqlanadi).
    const fromUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lang') : null;
    if (fromUrl && VALID.has(fromUrl)) {
      localStorage.setItem(KEY, fromUrl);
      return fromUrl as Lang;
    }
    const saved = localStorage.getItem(KEY);
    if (saved && VALID.has(saved)) return saved as Lang;
  } catch {
    /* localStorage mavjud emas */
  }
  // Saqlangan tanlov yo‘q bo‘lsa — o‘zbekcha (ilovaning asosiy tili); foydalanuvchi tilni Sozlamalar yoki sarlavhadagi menyudan o‘zgartiradi.
  return 'uz';
}

/** Joriy til: sahifa yuklanganda aniqlanadi; o‘zgartirilganda sahifa qayta yuklanadi (barcha matnlar yangi tilda chiqadi). */
export const lang: Lang = detect();

if (typeof document !== 'undefined') document.documentElement.lang = lang === 'uz-Cyrl' ? 'uz-Cyrl' : lang;

export function setLanguage(next: Lang): void {
  if (next === lang) return;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  window.location.reload();
}

/** Kalit — o‘zbekcha (lotin) asl matn; apostrof turlari farqi hisobga olinmaydi. */
const norm = (value: string) => value.replace(/[‘’ʻʼ`]/g, "'").trim();

function buildIndex(source: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(source).map(([key, value]) => [norm(key), value]));
}
const RU = buildIndex({ ...ru, ...ruExtra });
const EN = buildIndex({ ...en, ...enExtra });

function interpolate(text: string, params?: Record<string, string | number | null | undefined>): string {
  if (!params) return text;
  return text.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) => (name in params ? String(params[name] ?? '') : match));
}

/** Matnni joriy tilga tarjima qiladi. Tarjima topilmasa — o‘zbekcha asl matn (kirill uchun avtomatik o‘giriladi). */
export function t(key: string, params?: Record<string, string | number | null | undefined>): string {
  if (lang === 'uz') return interpolate(key, params);
  if (lang === 'uz-Cyrl') return toUzbekCyrillic(interpolate(key, params));
  const dict = lang === 'ru' ? RU : EN;
  const core = norm(key);
  let text = dict.get(core);
  if (text === undefined) text = matchPattern(dict, core, key);
  if (text === undefined) return interpolate(key, params);
  // Asl matn boshi/oxiridagi bo‘shliqlar saqlanadi (tarjima tinish belgisidan boshlansa — bo‘shliqsiz).
  const lead = /^\s*/.exec(key)?.[0] ?? '';
  const trail = /\s*$/.exec(key)?.[0] ?? '';
  const out = interpolate(text, params);
  return (/^[.,;:!?)—]/.test(out) ? '' : lead) + out + trail;
}

/** «{param}» li kalitlar uchun regex moslash (server xabarlari: «{n} ta ...» shaklida kelganda). */
const PATTERNS = new Map<Map<string, string>, Array<[RegExp, string, string[]]>>();
function matchPattern(dict: Map<string, string>, core: string, _original: string): string | undefined {
  let list = PATTERNS.get(dict);
  if (!list) {
    list = [];
    for (const [k, v] of dict) {
      if (!/\{[A-Za-z0-9_]+\}/.test(k)) continue;
      const names: string[] = [];
      // Avval {param} larni belgilab, qolgan matndagi maxsus belgilarni qochiramiz.
      const source = k
        .split(/(\{[A-Za-z0-9_]+\})/)
        .map((part) => {
          const m = /^\{([A-Za-z0-9_]+)\}$/.exec(part);
          if (m) {
            names.push(m[1]!);
            return '(.+?)';
          }
          return part.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
        })
        .join('');
      list.push([new RegExp('^' + source + '$'), v, names]);
    }
    PATTERNS.set(dict, list);
  }
  for (const [re, value, names] of list) {
    const m = re.exec(core);
    if (m) return value.replace(/\{([A-Za-z0-9_]+)\}/g, (_x, name: string) => m[names.indexOf(name) + 1] ?? '');
  }
  return undefined;
}

/** Oy qisqartmalari (sana formatlash uchun). */
export const MONTHS: Record<Lang, string[]> = {
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
  'uz-Cyrl': ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

export const NUMBER_LOCALE: Record<Lang, string> = { uz: 'uz-UZ', 'uz-Cyrl': 'uz-Cyrl-UZ', ru: 'ru-RU', en: 'en-US' };
