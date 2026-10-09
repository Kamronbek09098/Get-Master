import { afterEach, describe, expect, it } from 'vitest';
import { commissionRate, splitCommission } from './commission';

const original = process.env.PLATFORM_COMMISSION_RATE;
afterEach(() => {
  if (original === undefined) delete process.env.PLATFORM_COMMISSION_RATE;
  else process.env.PLATFORM_COMMISSION_RATE = original;
});

describe('commission', () => {
  it('defaults to 5% and ignores unusable values', () => {
    delete process.env.PLATFORM_COMMISSION_RATE;
    expect(commissionRate()).toBe(0.05);
    process.env.PLATFORM_COMMISSION_RATE = '';
    expect(commissionRate()).toBe(0.05);
    process.env.PLATFORM_COMMISSION_RATE = 'abc';
    expect(commissionRate()).toBe(0.05);
    process.env.PLATFORM_COMMISSION_RATE = '0.9';
    expect(commissionRate()).toBe(0.05);
    process.env.PLATFORM_COMMISSION_RATE = '0.1';
    expect(commissionRate()).toBe(0.1);
  });

  it('splits an amount so that fee + master share equals the amount', () => {
    expect(splitCommission(150_000, 0.05)).toEqual({ platformFee: 7500, masterAmount: 142_500 });
    const odd = splitCommission(33_333, 0.05);
    expect(odd.platformFee).toBe(1666.65);
    expect(Math.round((odd.platformFee + odd.masterAmount) * 100) / 100).toBe(33_333);
    expect(splitCommission(0, 0.05)).toEqual({ platformFee: 0, masterAmount: 0 });
  });
});
