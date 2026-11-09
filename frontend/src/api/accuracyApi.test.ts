import { describe, expect, it } from 'vitest';
import { skillPercent } from './accuracyApi';

describe('skillPercent', () => {
  it('is positive when the model beats keeping the latest reading', () => {
    expect(skillPercent({ lead: 1, count: 10, mae: 0.4, persistenceMae: 0.5, levelAccuracy: 0.9 })).toBe(20);
    expect(skillPercent({ lead: 1, count: 10, mae: 0.69, persistenceMae: 0.51, levelAccuracy: 0.9 })).toBe(-35);
  });

  it('is zero when there is no baseline error', () => {
    expect(skillPercent({ lead: 1, count: 10, mae: 0, persistenceMae: 0, levelAccuracy: 1 })).toBe(0);
  });
});
