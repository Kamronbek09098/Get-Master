import { MONTHS, NUMBER_LOCALE, lang, t } from '@/i18n';

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function formatMoney(amount: string | number, currency = 'UZS'): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(value)) return '—';
  return (
    new Intl.NumberFormat(NUMBER_LOCALE[lang], {
      style: 'decimal',
      maximumFractionDigits: 0,
    }).format(value) +
    ' ' +
    currency
  );
}

const MONTH_NAMES = MONTHS[lang];

const tashkentParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tashkent',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function parts(date: Date): Record<string, string> {
  return Object.fromEntries(tashkentParts.formatToParts(date).map((part) => [part.type, part.value]));
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  const p = parts(date);
  return `${Number(p.day)} ${MONTH_NAMES[Number(p.month) - 1]} ${p.year}, ${p.hour}:${p.minute}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  const p = parts(date);
  return `${Number(p.day)} ${MONTH_NAMES[Number(p.month) - 1]} ${p.year}`;
}

const RELATIVE_UNITS: Array<[label: string, seconds: number]> = [
  ['yil', 365 * 86_400],
  ['oy', 30 * 86_400],
  ['kun', 86_400],
  ['soat', 3_600],
  ['daqiqa', 60],
];

/** «3 kun oldin» / «2 soatdan keyin» — tilga mos (rus/ingliz tillarida birlik qisqa). */
function relativeText(amount: number, unit: string, past: boolean): string {
  if (lang === 'ru') {
    const short: Record<string, string> = { yil: 'г.', oy: 'мес.', kun: 'дн.', soat: 'ч.', daqiqa: 'мин.' };
    return past ? `${amount} ${short[unit]} назад` : `через ${amount} ${short[unit]}`;
  }
  if (lang === 'en') {
    const short: Record<string, string> = { yil: 'y', oy: 'mo', kun: 'd', soat: 'h', daqiqa: 'min' };
    return past ? `${amount}${short[unit]} ago` : `in ${amount}${short[unit]}`;
  }
  const label = t(unit);
  if (lang === 'uz-Cyrl') return past ? `${amount} ${label} олдин` : `${amount} ${label}дан кейин`;
  return past ? `${amount} ${label} oldin` : t('{amount} {label}dan keyin', { amount, label });
}

export function formatRelativeTime(value: string | Date, now: number = Date.now()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diff = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(diff);
  if (abs < 45) return t('hozirgina');
  for (const [label, seconds] of RELATIVE_UNITS) {
    if (abs >= seconds || label === 'daqiqa') {
      const amount = Math.max(1, Math.round(abs / seconds));
      return relativeText(amount, label, diff < 0);
    }
  }
  return t('hozirgina');
}

/** `ms` — qolgan millisekund (masalan `useCountdown` dan). Kun/soat/daqiqa ko‘rinishida chiqaradi. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return t('Muddati tugagan');
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return t('{days} kun {hours} soat qoldi', { days, hours });
  if (hours > 0) return t('{hours} soat {minutes} daqiqa qoldi', { hours, minutes });
  if (minutes > 0) return t('{minutes} daqiqa qoldi', { minutes });
  return t('1 daqiqadan kam qoldi');
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function initials(name: string | null | undefined): string {
  const words = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter((word) => /^\p{L}/u.test(word));
  if (words.length === 0) return '•';
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}
