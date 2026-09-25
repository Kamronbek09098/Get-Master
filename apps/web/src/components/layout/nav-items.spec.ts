import { describe, expect, it } from 'vitest';
import { getNavItems } from './nav-items';

describe('getNavItems', () => {
  it('gives admins only admin sections plus shared ones', () => {
    const paths = getNavItems('ADMIN').map((item) => item.to);
    expect(paths[0]).toBe('/admin');
    expect(paths).toContain('/admin/tasdiqlash');
    expect(paths).not.toContain('/mijozlar/sorovlar');
    expect(paths).not.toContain('/ustalar/profil');
  });

  it('gives masters their working tools', () => {
    const paths = getNavItems('MASTER').map((item) => item.to);
    expect(paths).toEqual(expect.arrayContaining(['/ustalar/jadval', '/ustalar/portfolio', '/ustalar/daromad', '/ustalar/mening-takliflarim']));
    expect(getNavItems('MASTER').filter((item) => item.primary).length).toBeLessThanOrEqual(4);
    expect(paths.some((path) => path.startsWith('/admin'))).toBe(false);
  });

  it('defaults to the customer menu', () => {
    for (const role of ['CUSTOMER', null] as const) {
      const paths = getNavItems(role).map((item) => item.to);
      expect(paths[0]).toBe('/mijozlar/sorovlar');
      expect(paths).toContain('/mijozlar/tolovlar');
    }
  });

  it('never repeats a path within one menu', () => {
    for (const role of ['ADMIN', 'MASTER', 'CUSTOMER'] as const) {
      const paths = getNavItems(role).map((item) => item.to);
      expect(new Set(paths).size).toBe(paths.length);
    }
  });

  it('gives every item an icon and a group, and keeps at most 4 primary items for the mobile bar', () => {
    for (const role of ['ADMIN', 'MASTER', 'CUSTOMER'] as const) {
      const items = getNavItems(role);
      for (const item of items) {
        expect(item.icon).toBeTruthy();
        expect(item.group).toBeTruthy();
      }
      expect(items.filter((item) => item.primary).length).toBeLessThanOrEqual(4);
    }
  });
});
