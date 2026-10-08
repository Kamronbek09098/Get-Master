import { describe, expect, it } from 'vitest';
import { buildStories } from './stories';

describe('real-world stories', () => {
  const stories = buildStories();

  it('defines the six service-call stories with unique ids', () => {
    expect(stories.map((s) => s.id)).toEqual(['konditsioner', 'santexnika', 'elektrik', 'maishiy-texnika', 'duradgor', 'tamirlash']);
    expect(new Set(stories.map((s) => s.id)).size).toBe(stories.length);
  });

  it('follows the same 8-stage timeline (problem → … → customer) in ascending order', () => {
    for (const story of stories) {
      expect(story.chapters).toHaveLength(8);
      const at = story.chapters.map((c) => c.at);
      // Standart xronologiya; videosi alohida montaj qilingan hikoyalar (masalan, santexnika) o‘z vaqtlariga ega, lekin har doim 0 dan boshlanib o‘sib boradi.
      if (story.id !== 'santexnika') expect(at).toEqual([0, 0.15, 0.3, 0.5, 0.7, 0.85, 0.95, 1]);
      expect(at[0]).toBe(0);
      expect([...at].sort((a, b) => a - b)).toEqual(at);
      expect(at.every((value) => value >= 0 && value <= 1)).toBe(true);
      story.chapters.forEach((c) => {
        expect(c.title.length).toBeGreaterThan(3);
        expect(c.text.length).toBeGreaterThan(10);
      });
    }
  });

  it('ids are URL-safe ASCII (they become media folder names)', () => {
    for (const story of stories) expect(story.id).toMatch(/^[a-z0-9-]+$/);
  });
});
