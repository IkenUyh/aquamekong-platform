import { describe, expect, it } from 'vitest';
import { percentChange } from './reportApi';

describe('percentChange', () => {
  it('computes the change against the previous period, rounded to 0.1%', () => {
    expect(percentChange({ current: 3.3, previous: 3 })).toBe(10);
    expect(percentChange({ current: 2, previous: 3 })).toBe(-33.3);
  });

  it('returns null when a period has no data or the base is zero', () => {
    expect(percentChange({ current: 3, previous: null })).toBeNull();
    expect(percentChange({ current: null, previous: 3 })).toBeNull();
    expect(percentChange({ current: 3, previous: 0 })).toBeNull();
  });
});
