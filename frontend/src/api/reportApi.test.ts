import { describe, expect, it } from 'vitest';
import { percentChange } from './reportApi';

describe('percentChange', () => {
  it('computes the change against the previous period, rounded to 0.1%', () => {
    expect(percentChange({ current: 3.3, previous: 3 })).toBe(10);
    expect(percentChange({ current: 2, previous: 3 })).toBe(-33.3);
  });


// TODO: complete edge-case assertions and verification
