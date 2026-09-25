export const MARKETPLACE_UTC_OFFSET_MINUTES = 300;

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface ScheduleWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  effectiveFrom?: Date | null;
  effectiveUntil?: Date | null;
}

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function toLocalParts(instant: Date): { dayOfWeek: number; minutes: number; dayStartUtc: Date } {
  const shifted = new Date(instant.getTime() + MARKETPLACE_UTC_OFFSET_MINUTES * 60_000);
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  const dayStartUtc = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
      MARKETPLACE_UTC_OFFSET_MINUTES * 60_000,
  );
  return { dayOfWeek: shifted.getUTCDay(), minutes, dayStartUtc };
}

function isEffective(window: ScheduleWindow, instant: Date): boolean {
  if (window.effectiveFrom && window.effectiveFrom > instant) return false;
  if (window.effectiveUntil && window.effectiveUntil < instant) return false;
  return true;
}

export function fitsSchedule(windows: ScheduleWindow[], start: Date, end: Date = start): boolean {
  if (windows.length === 0) return true;
  const from = toLocalParts(start);
  const to = toLocalParts(end);
  if (from.dayStartUtc.getTime() !== to.dayStartUtc.getTime()) return false;
  return windows.some(
    (w) =>
      w.isAvailable &&
      w.dayOfWeek === from.dayOfWeek &&
      isEffective(w, start) &&
      toMinutes(w.startTime) <= from.minutes &&
      to.minutes <= toMinutes(w.endTime),
  );
}
