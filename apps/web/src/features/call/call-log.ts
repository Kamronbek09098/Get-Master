import { t } from '@/i18n';
import type { CallLogEntry } from './types';

const PREFIX = 'call:';

/** SYSTEM xabari qo‘ng‘iroq yozuvimi — shunda mazmunini qaytaradi. */
export function parseCallLog(text: string | null | undefined): CallLogEntry | null {
  if (!text || !text.startsWith(PREFIX)) return null;
  try {
    const entry = JSON.parse(text.slice(PREFIX.length)) as CallLogEntry;
    return entry && typeof entry.callId === 'string' ? entry : null;
  } catch {
    return null;
  }
}

/** 125 → «2:05», 3725 → «1:02:05». */
export function formatDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return `${hours > 0 ? `${hours}:` : ''}${mm}:${String(seconds).padStart(2, '0')}`;
}

/** Chatdagi qo‘ng‘iroq yozuvi matni: sarlavha va (bo‘lsa) davomiyligi. */
export function describeCallLog(entry: CallLogEntry, meId: string | undefined): { title: string; detail: string | null; failed: boolean } {
  const mine = !!meId && entry.callerId === meId;
  const video = entry.mode === 'VIDEO';
  const kind = video ? t('Video qo‘ng‘iroq') : t('Audio qo‘ng‘iroq');
  if (entry.status === 'ENDED' || entry.status === 'ACTIVE') {
    return { title: kind, detail: entry.seconds > 0 ? formatDuration(entry.seconds) : null, failed: false };
  }
  if (entry.status === 'DECLINED') return { title: kind, detail: mine ? t('Rad etildi') : t('Rad etdingiz'), failed: true };
  if (entry.status === 'CANCELED') return { title: kind, detail: mine ? t('Bekor qilindi') : t('O‘tkazib yuborilgan'), failed: !mine };
  if (entry.status === 'MISSED') return { title: kind, detail: mine ? t('Javob berilmadi') : t('O‘tkazib yuborilgan'), failed: true };
  return { title: kind, detail: t('Aloqa uzildi'), failed: true };
}
