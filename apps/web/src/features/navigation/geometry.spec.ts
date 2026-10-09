import { describe, expect, it } from 'vitest';
import type { NavRoute } from '@/features/geo/geo.service';
import { bearing, distanceM, formatDistance, formatDuration, maneuverOf, progressOn } from './geometry';

// Toshkent: ~1,1 km sharqqa, so‘ng ~1,1 km shimolga.
const route: NavRoute = {
  distanceM: 2200,
  durationS: 200,
  geometry: [
    [69.24, 41.3],
    [69.2525, 41.3],
    [69.2525, 41.31],
  ],
  steps: [
    { type: 'depart', modifier: null, name: 'A', distanceM: 1050, durationS: 100, location: [69.24, 41.3] },
    { type: 'turn', modifier: 'left', name: 'B', distanceM: 1100, durationS: 100, location: [69.2525, 41.3] },
    { type: 'arrive', modifier: null, name: '', distanceM: 0, durationS: 0, location: [69.2525, 41.31] },
  ],
};

describe('navigation geometry', () => {
  it('measures distance and bearing', () => {
    expect(distanceM({ lat: 41.3, lon: 69.24 }, { lat: 41.3, lon: 69.2525 })).toBeGreaterThan(1000);
    expect(Math.round(bearing({ lat: 41.3, lon: 69.24 }, { lat: 41.31, lon: 69.24 }))).toBe(0);
    expect(Math.round(bearing({ lat: 41.3, lon: 69.24 }, { lat: 41.3, lon: 69.25 }))).toBe(90);
  });

  it('computes remaining distance, next turn and off-route distance', () => {
    const start = progressOn(route, { lat: 41.3, lon: 69.24 });
    expect(start.remainingM).toBeGreaterThan(2000);
    expect(start.stepIndex).toBe(0);
    expect(start.toNextM).toBeGreaterThan(1000);
    expect(start.offRouteM).toBeLessThan(5);

    const middle = progressOn(route, { lat: 41.3, lon: 69.2488 });
    expect(middle.remainingM).toBeLessThan(start.remainingM);
    expect(middle.toNextM).toBeLessThan(400);

    const afterTurn = progressOn(route, { lat: 41.305, lon: 69.2525 });
    expect(afterTurn.stepIndex).toBe(1);
    expect(afterTurn.remainingM).toBeLessThan(700);

    const off = progressOn(route, { lat: 41.3, lon: 69.26 }, 0);
    expect(off.offRouteM).toBeGreaterThan(300);
  });

  it('maps maneuvers and formats numbers', () => {
    expect(maneuverOf({ type: 'turn', modifier: 'slight right' })).toBe('slight-right');
    expect(maneuverOf({ type: 'arrive', modifier: null })).toBe('arrive');
    expect(maneuverOf({ type: 'roundabout', modifier: 'right' })).toBe('roundabout');
    expect(formatDistance(1250)).toBe('1,3 km');
    expect(formatDistance(340)).toBe('350 m');
    expect(formatDuration(540)).toBe('9 daq');
    expect(formatDuration(3720)).toBe('1 soat 2 daq');
  });
});

import { tierFor } from './voice';

describe('voice tiers', () => {
  it('announces at the right distance and skips tiers longer than the street', () => {
    expect(tierFor(2000, 5000)).toBeNull();
    expect(tierFor(1030, 5000)).toBe(1000);
    expect(tierFor(480, 5000)).toBe(500);
    expect(tierFor(195, 5000)).toBe(200);
    expect(tierFor(40, 5000)).toBe(0);
    // 300 m lik ko‘chada «1 km» va «500 m» e’lon qilinmaydi
    expect(tierFor(290, 300)).toBeNull();
    expect(tierFor(195, 300)).toBe(200);
  });
});
