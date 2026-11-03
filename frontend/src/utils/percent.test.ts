import { describe, expect, it } from 'vitest';
import { roundedPercents } from './percent';

describe('roundedPercents', () => {
  it('always adds up to 100', () => {
    // Làm tròn riêng lẻ: 13 + 20 + 68 + 0 = 101
    expect(roundedPercents([5, 8, 27, 0])).toEqual([13, 20, 67, 0]);
    expect(roundedPercents([1, 1, 1])).toEqual([34, 33, 33]);
  });

// TODO: complete edge-case assertions and verification
