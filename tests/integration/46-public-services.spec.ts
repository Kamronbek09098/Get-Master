import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootHarness, type Harness } from '../helpers/harness';

let h: Harness;

beforeAll(async () => {
  h = await bootHarness();
});
afterAll(async () => {
  await h.close();
});

interface Item { id: string; name: string; category: { id: string; name: string }; masters: number; minPrice: number | null; maxPrice: number | null; rating: number | null; ratingCount: number }

describe('public service catalog', () => {
  it('returns paged services with facets that match the totals', async () => {
    const res = await h.api('GET', '/public/services?limit=48');
    expect(res.status).toBe(200);
    expect(res.data.total).toBeGreaterThan(0);
    expect(res.data.items.length).toBeLessThanOrEqual(48);
    const facets = res.data.facets;
    expect(facets.categories.reduce((sum: number, c: { count: number }) => sum + c.count, 0)).toBe(res.data.total);
    expect(facets.masters.one + facets.masters.few + facets.masters.many).toBeLessThanOrEqual(res.data.total);
    for (const item of res.data.items as Item[]) {
      expect(item.category.id).toBeTruthy();
      expect(item.masters).toBeGreaterThanOrEqual(0);
      if (item.minPrice !== null && item.maxPrice !== null) expect(item.minPrice).toBeLessThanOrEqual(item.maxPrice);
    }
  });

  it('filters by category, query and masters; keeps results consistent with facets', async () => {
    const all = await h.api('GET', '/public/services?limit=48');
    const category = all.data.facets.categories[0] as { id: string; count: number };
    const byCategory = await h.api('GET', `/public/services?categories=${category.id}&limit=48`);
    expect(byCategory.status).toBe(200);
    expect(byCategory.data.total).toBe(category.count);
    expect((byCategory.data.items as Item[]).every((i) => i.category.id === category.id)).toBe(true);

    const first = all.data.items[0] as Item;
    const q = await h.api('GET', `/public/services?q=${encodeURIComponent(first.name)}`);
    expect((q.data.items as Item[]).some((i) => i.id === first.id)).toBe(true);

    const many = await h.api('GET', '/public/services?masters=4%2B&limit=48');
    expect((many.data.items as Item[]).every((i) => i.masters >= 4)).toBe(true);
    const none = await h.api('GET', '/public/services?q=zzzz-yoq-xizmat-zzzz');
    expect(none.data.total).toBe(0);
  });

  it('sorts and paginates', async () => {
    const asc = await h.api('GET', '/public/services?sort=price_asc&available=true&limit=48');
    const prices = (asc.data.items as Item[]).map((i) => i.minPrice).filter((p): p is number => p !== null);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const p1 = await h.api('GET', '/public/services?limit=2&page=1');
    const p2 = await h.api('GET', '/public/services?limit=2&page=2');
    if (p1.data.total > 2) {
      expect(p1.data.pages).toBe(Math.ceil(p1.data.total / 2));
      expect((p1.data.items as Item[])[0].id).not.toBe((p2.data.items as Item[])[0].id);
    }
  });

  it('rejects malformed input', async () => {
    expect((await h.api('GET', '/public/services?categories=nope')).status).toBe(400);
    expect((await h.api('GET', '/public/services?sort=hack')).status).toBe(400);
    expect((await h.api('GET', '/public/services?region=mars')).status).toBe(400);
    expect((await h.api('GET', '/public/services?limit=500')).status).toBe(400);
  });
});
