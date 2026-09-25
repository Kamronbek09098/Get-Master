import { describe, expect, it } from 'vitest';
import { fitsSchedule, toLocalParts, type ScheduleWindow } from '../../src/common/utils/schedule';

const monday = (hhmmUtc: string) => new Date(`2026-09-21T${hhmmUtc}:00Z`);
const window = (over: Partial<ScheduleWindow> = {}): ScheduleWindow => ({
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '18:00',
  isAvailable: true,
  ...over,
});

describe('toLocalParts', () => {
  it('converts UTC to the marketplace zone (UTC+5)', () => {
    expect(toLocalParts(monday('05:30'))).toMatchObject({ dayOfWeek: 1, minutes: 10 * 60 + 30 });
  });
  it('rolls the weekday over at local midnight', () => {
    expect(toLocalParts(monday('20:00')).dayOfWeek).toBe(2);
  });
});

describe('fitsSchedule', () => {
  it('treats a master with no windows as always available', () => {
    expect(fitsSchedule([], monday('03:00'))).toBe(true);
  });
  it('accepts a job fully inside a window', () => {
    expect(fitsSchedule([window()], monday('05:00'), monday('07:00'))).toBe(true);
  });
  it('rejects a job that runs past the window end', () => {
    expect(fitsSchedule([window()], monday('12:00'), monday('14:30'))).toBe(false);
  });
  it('rejects the wrong weekday and unavailable windows', () => {
    expect(fitsSchedule([window({ dayOfWeek: 2 })], monday('05:00'))).toBe(false);
    expect(fitsSchedule([window({ isAvailable: false })], monday('05:00'))).toBe(false);
  });
  it('honours effective date ranges', () => {
    const w = window({ effectiveUntil: new Date('2026-09-20T00:00:00Z') });
    expect(fitsSchedule([w], monday('05:00'))).toBe(false);
  });
  it('rejects a job crossing local midnight', () => {
    expect(fitsSchedule([window({ endTime: '23:59' })], monday('18:00'), monday('20:00'))).toBe(false);
  });
});
