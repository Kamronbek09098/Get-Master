export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function formatMoney(amount: string | number, currency = 'UZS'): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('uz-UZ', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(value) + ' ' + currency;
}

const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

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
  return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]} ${p.year}, ${p.hour}:${p.minute}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  const p = parts(date);
  return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]} ${p.year}`;
}

const RELATIVE_UNITS: Array<[label: string, seconds: number]> = [
  ['yil', 365 * 86_400],
  ['oy', 30 * 86_400],
  ['kun', 86_400],
  ['soat', 3_600],
  ['daqiqa', 60],
];

export function formatRelativeTime(value: string | Date, now: number = Date.now()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diff = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(diff);
  if (abs < 45) return 'hozirgina';
  for (const [label, seconds] of RELATIVE_UNITS) {
    if (abs >= seconds || label === 'daqiqa') {
      const amount = Math.max(1, Math.round(abs / seconds));
      return diff < 0 ? `${amount} ${label} oldin` : `${amount} ${label}dan keyin`;
    }
  }
  return 'hozirgina';
}

/** `ms` — qolgan millisekund (masalan `useCountdown` dan). Kun/soat/daqiqa ko‘rinishida chiqaradi. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Muddati tugagan';
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} kun ${hours} soat qoldi`;
  if (hours > 0) return `${hours} soat ${minutes} daqiqa qoldi`;
  if (minutes > 0) return `${minutes} daqiqa qoldi`;
  return '1 daqiqadan kam qoldi';
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
