import { env } from '@/lib/env';
import type { ChatMessage, Conversation } from './types';
import { t } from '@/i18n';
import { describeCallLog, parseCallLog } from '@/features/call/call-log';

const MONTHS_FULL = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tashkent',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: string;
  minute: string;
}

function parts(value: string | Date): Parts {
  const date = value instanceof Date ? value : new Date(value);
  const map = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day), hour: map.hour!, minute: map.minute! };
}

/** «14:05» (Toshkent vaqti). */
export function clock(value: string | Date): string {
  const p = parts(value);
  return `${p.hour}:${p.minute}`;
}

export function dayKey(value: string | Date): string {
  const p = parts(value);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function daysBetween(a: string | Date, b: string | Date): number {
  const [ay, am, ad] = dayKey(a).split('-').map(Number) as [number, number, number];
  const [by, bm, bd] = dayKey(b).split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Kun ajratgichi: «Bugun», «Kecha» yoki «24 sentabr» (boshqa yil bo‘lsa yili bilan). */
export function dayLabel(value: string | Date, now: Date = new Date()): string {
  const diff = daysBetween(value, now);
  if (diff === 0) return t('Bugun');
  if (diff === 1) return t('Kecha');
  const p = parts(value);
  const base = `${p.day} ${MONTHS_FULL[p.month - 1]}`;
  return p.year === parts(now).year ? base : `${base} ${p.year}`;
}

/** Suhbatlar ro‘yxatidagi vaqt: bugun — soat, kecha — «Kecha», boshqasi — «24 sen». */
export function listTime(value: string | Date, now: Date = new Date()): string {
  const diff = daysBetween(value, now);
  if (diff === 0) return clock(value);
  if (diff === 1) return t('Kecha');
  const p = parts(value);
  return `${p.day} ${MONTHS_SHORT[p.month - 1]}`;
}

export type TimelineItem =
  | { type: 'day'; key: string; label: string }
  | { type: 'message'; key: string; message: ChatMessage; mine: boolean; first: boolean; last: boolean };

const GROUP_GAP_MS = 5 * 60_000;

/** Bir odam turli panelda (mijoz/usta) — turli akkaunt: xabar egasi (id + panel) juftligi bilan aniqlanadi. */
export function isOwnMessage(message: ChatMessage, meId: string | undefined): boolean {
  if (!meId || message.senderId !== meId) return false;
  return !message.senderPanel || !env.appRole || message.senderPanel === env.appRole;
}

const senderKey = (message: ChatMessage) => `${message.senderId}:${message.senderPanel ?? ''}`;

/**
 * Xabarlarni (eskisidan yangisiga) kun ajratgichlari va guruhlar bilan tartiblaydi:
 * bir odamning ketma-ket xabarlari (5 daqiqa ichida) bitta guruh bo‘ladi.
 */
export function buildTimeline(messages: ChatMessage[], meId: string | undefined, now: Date = new Date()): TimelineItem[] {
  const items: TimelineItem[] = [];
  let previous: ChatMessage | null = null;
  messages.forEach((message, index) => {
    const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
    if (newDay) items.push({ type: 'day', key: `day-${dayKey(message.createdAt)}`, label: dayLabel(message.createdAt, now) });

    const sameGroupAsPrevious =
      !!previous &&
      !newDay &&
      senderKey(previous) === senderKey(message) &&
      new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < GROUP_GAP_MS;
    const next = messages[index + 1];
    const sameGroupAsNext =
      !!next &&
      dayKey(next.createdAt) === dayKey(message.createdAt) &&
      senderKey(next) === senderKey(message) &&
      new Date(next.createdAt).getTime() - new Date(message.createdAt).getTime() < GROUP_GAP_MS;

    items.push({
      type: 'message',
      key: message.id,
      message,
      mine: isOwnMessage(message, meId),
      first: !sameGroupAsPrevious,
      last: !sameGroupAsNext,
    });
    previous = message;
  });
  return items;
}

/** Yuborgan xabarim suhbatdosh tomonidan o‘qilganmi (o‘qilgan vaqt xabardan keyin). */
export function isRead(message: ChatMessage, counterpartLastReadAt: string | null | undefined): boolean {
  return !!counterpartLastReadAt && new Date(message.createdAt).getTime() <= new Date(counterpartLastReadAt).getTime();
}

export function previewText(conversation: Conversation, meId: string | undefined): string {
  const last = conversation.lastMessage;
  if (!last) return t('Xabar yo‘q');
  const callEntry = last.type === 'SYSTEM' ? parseCallLog(last.text) : null;
  const text = last.deleted ? t('Xabar o‘chirilgan') : callEntry ? describeCallLog(callEntry, meId).title : (last.text ?? replySnippet(last));
  return isOwnMessage(last, meId) ? t('Siz: {text}', { text }) : text;
}

/** Telegramdagidek: xabarni yuborilganidan keyingi 48 soat ichida tahrirlash mumkin (backend qoidasi). */
export const EDIT_WINDOW_MS = 48 * 60 * 60_000;

export function canEdit(message: ChatMessage, now: number = Date.now()): boolean {
  return !message.deleted && !message.status && message.type !== 'SYSTEM' && message.type !== 'ORDER' && now - new Date(message.createdAt).getTime() <= EDIT_WINDOW_MS;
}

const TONES = 8;

/** Foydalanuvchiga barqaror rang (0..7) beradi — avatar uchun. */
export function avatarTone(seed: string | null | undefined): number {
  seed = seed ?? "";
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % TONES;
}

/** Javob/iqtibos uchun qisqa matn. */
export function replySnippet(message: {
  text?: string | null;
  type?: string;
  deleted?: boolean;
  deletedAt?: string | null;
  attachments?: Array<{ name: string; mimeType: string }> | null;
}): string {
  if (message.deleted || message.deletedAt) return t('Xabar o‘chirilgan');
  if (message.text) return message.text;
  if (message.attachments?.some((a) => /^voice-/i.test(a.name) || a.mimeType.startsWith('audio/'))) return t('🎤 Ovozli xabar');
  if (message.type === 'IMAGE') return t('📷 Rasm');
  if (message.type === 'VIDEO') return t('🎬 Video');
  if (message.type === 'FILE') return t('📎 Fayl');
  return t('Xabar');
}
