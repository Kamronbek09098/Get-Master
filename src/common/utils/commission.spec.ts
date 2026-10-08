import { afterEach, describe, expect, it } from 'vitest';
import { commissionRate, splitCommission } from './commission';

const original = process.env.PLATFORM_COMMISSION_RATE;
afterEach(() => {
  if (original === undefined) delete process.env.PLATFORM_COMMISSION_RATE;
  else process.env.PLATFORM_COMMISSION_RATE = original;
});

describe('commission', () => {
  it('defaults to 2% and ignores unusable values', () => {
    delete process.env.PLATFORM_COMMISSION_RATE;
    expect(commissionRate()).toBe(0.02);
    process.env.PLATFORM_COMMISSION_RATE = '';
    expect(commissionRate()).toBe(0.02);
    process.env.PLATFORM_COMMISSION_RATE = 'abc';
    expect(commissionRate()).toBe(0.02);
    process.env.PLATFORM_COMMISSION_RATE = '0.9';
    expect(commissionRate()).toBe(0.02);
    process.env.PLATFORM_COMMISSION_RATE = '0.05';
    expect(commissionRate()).toBe(0.05);
  });

  it('splits an amount so that fee + master share equals the amount', () => {
    expect(splitCommission(150_000, 0.02)).toEqual({ platformFee: 3000, masterAmount: 147_000 });
    const odd = splitCommission(33_333, 0.02);
    expect(odd.platformFee).toBe(666.66);
    expect(Math.round((odd.platformFee + odd.masterAmount) * 100) / 100).toBe(33_333);
    expect(splitCommission(0, 0.02)).toEqual({ platformFee: 0, masterAmount: 0 });
  });
});
