import { describe, expect, it } from 'vitest';
import { avatarTone, buildTimeline, canEdit, clock, dayLabel, isRead, listTime } from './format';
import type { ChatMessage } from './types';

const NOW = new Date('2026-09-24T09:00:00Z');

const msg = (id: string, senderId: string, iso: string, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  conversationId: 'c1',
  senderId,
  type: 'TEXT',
  text: id,
  createdAt: iso,
  editedAt: null,
  deleted: false,
  ...over,
});

describe('clock / dayLabel / listTime (Toshkent vaqti)', () => {
  it('formats the clock in UTC+5', () => {
    expect(clock('2026-09-24T09:05:00Z')).toBe('14:05');
    expect(clock('2026-09-24T19:30:00Z')).toBe('00:30');
  });

  it('labels days: Bugun, Kecha, then the date (with year only when it differs)', () => {
    expect(dayLabel('2026-09-24T03:00:00Z', NOW)).toBe('Bugun');
    expect(dayLabel('2026-09-23T10:00:00Z', NOW)).toBe('Kecha');
    expect(dayLabel('2026-09-10T10:00:00Z', NOW)).toBe('10 sentabr');
    expect(dayLabel('2025-12-31T10:00:00Z', NOW)).toBe('31 dekabr 2025');
  });

  it('uses a compact time in the conversation list', () => {
    expect(listTime('2026-09-24T08:15:00Z', NOW)).toBe('13:15');
    expect(listTime('2026-09-23T10:00:00Z', NOW)).toBe('Kecha');
    expect(listTime('2026-09-01T10:00:00Z', NOW)).toBe('1 sen');
  });

  it('treats the Tashkent calendar day, not UTC, as the day boundary', () => {
    expect(dayLabel('2026-09-23T20:30:00Z', NOW)).toBe('Bugun');
  });
});

describe('buildTimeline', () => {
  it('inserts a day separator per day and groups consecutive messages of one sender', () => {
    const items = buildTimeline(
      [
        msg('a', 'u1', '2026-09-23T10:00:00Z'),
        msg('b', 'u1', '2026-09-23T10:01:00Z'),
        msg('c', 'me', '2026-09-23T10:02:00Z'),
        msg('d', 'me', '2026-09-24T05:00:00Z'),
      ],
      'me',
      NOW,
    );
    expect(items.map((item) => (item.type === 'day' ? `# ${item.label}` : item.message.id))).toEqual(['# Kecha', 'a', 'b', 'c', '# Bugun', 'd']);

    const flags = items.filter((item) => item.type === 'message').map((item) => (item.type === 'message' ? [item.message.id, item.mine, item.first, item.last] : []));
    expect(flags).toEqual([
      ['a', false, true, false],
      ['b', false, false, true],
      ['c', true, true, true],
      ['d', true, true, true],
    ]);
  });

  it('starts a new group after a pause of 5 minutes or more', () => {
    const items = buildTimeline([msg('a', 'u1', '2026-09-24T05:00:00Z'), msg('b', 'u1', '2026-09-24T05:06:00Z')], 'me', NOW);
    const messages = items.filter((item) => item.type === 'message');
    expect(messages.map((item) => (item.type === 'message' ? [item.first, item.last] : []))).toEqual([
      [true, true],
      [true, true],
    ]);
  });

  it('handles an empty conversation', () => {
    expect(buildTimeline([], 'me', NOW)).toEqual([]);
  });
});

describe('read receipts, editing window and avatar tone', () => {
  it('marks my message read only when the other side read after it was sent', () => {
    const m = msg('a', 'me', '2026-09-24T05:00:00Z');
    expect(isRead(m, null)).toBe(false);
    expect(isRead(m, '2026-09-24T04:59:00Z')).toBe(false);
    expect(isRead(m, '2026-09-24T05:00:00Z')).toBe(true);
    expect(isRead(m, '2026-09-24T06:00:00Z')).toBe(true);
  });

  it('allows editing only recent, real text messages', () => {
    const now = new Date('2026-09-24T05:10:00Z').getTime();
    expect(canEdit(msg('a', 'me', '2026-09-24T05:00:00Z'), now)).toBe(true);
    expect(canEdit(msg('a', 'me', '2026-09-22T04:00:00Z'), now)).toBe(false);
    expect(canEdit(msg('a', 'me', '2026-09-24T05:00:00Z', { deleted: true }), now)).toBe(false);
    expect(canEdit(msg('a', 'me', '2026-09-24T05:00:00Z', { status: 'pending' }), now)).toBe(false);
  });

  it('gives a stable avatar tone between 0 and 7', () => {
    expect(avatarTone('user-1')).toBe(avatarTone('user-1'));
    for (const seed of ['a', 'b', 'c', 'user-42', '']) {
      const tone = avatarTone(seed);
      expect(tone).toBeGreaterThanOrEqual(0);
      expect(tone).toBeLessThanOrEqual(7);
    }
  });
});
