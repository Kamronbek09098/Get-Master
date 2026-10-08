import { describe, expect, it } from 'vitest';
import { clock, compact, feedPostId, initials, POST_LINK } from './format';

const id = 'e368cddc-e4ee-4bfe-a878-69ee7001e382';

describe('feed formatting', () => {
  it('compacts counts', () => {
    expect(compact(0)).toBe('0');
    expect(compact(999)).toBe('999');
    expect(compact(1250)).toBe('1,3K');
    expect(compact(12_400)).toBe('12K');
    expect(compact(2_000_000)).toBe('2M');
  });
  it('formats durations and initials', () => {
    expect(clock(75)).toBe('1:15');
    expect(clock(5)).toBe('0:05');
    expect(initials('Azizbek U.')).toBe('AU');
    expect(initials('#573')).toBe('#');
  });
});

describe('shared feed links in chat', () => {
  it('recognises a message that is only a feed link', () => {
    expect(feedPostId(`http://localhost:5173/mijoz/lenta?post=${id}`)).toBe(id);
    expect(feedPostId(`  https://getmaster.uz/usta/lenta?post=${id}  `)).toBe(id);
    expect(POST_LINK.test(`/mijoz/lenta?post=${id}`)).toBe(true);
  });
  it('ignores ordinary text and links with extra words', () => {
    expect(feedPostId('Salom, qalaysiz?')).toBeNull();
    expect(feedPostId(null)).toBeNull();
    expect(feedPostId(`Mana qarang http://x.uz/mijoz/lenta?post=${id}`)).toBeNull();
  });
});
