import { describe, expect, it } from 'vitest';
import type { Crop, CropStage } from '../api/cropApi';
import { seasonDay, stageSegments } from './cropSchedule';

const stage = (code: string, order: number, durationDays: number | null, flexible = false): CropStage => ({
  code, name: code, order, durationDays, flexible, durationSource: null,
  maxSalinity: 4, minSalinity: null, thresholdSource: 'x', thresholdNote: null,
});

const rice: Crop = {
  code: 'lua', name: 'Lúa', category: 'CROP', faoYield: null, faoNote: null,
  stages: [stage('chin', 4, 30), stage('ma', 1, null), stage('lam_dong_tro', 3, 35), stage('de_nhanh', 2, null, true)],
};

describe('stageSegments', () => {
  it('lays rice out like the backend: tillering takes the rest, seedling has no length yet', () => {
    expect(stageSegments(rice, 95)).toEqual([
      { code: 'de_nhanh', name: 'de_nhanh', start: 0, end: 30 },
      { code: 'lam_dong_tro', name: 'lam_dong_tro', start: 30, end: 65 },
      { code: 'chin', name: 'chin', start: 65, end: 95 },
    ]);
  });

  it('has no bar for single-stage crops or without the variety length', () => {
    expect(stageSegments({ ...rice, stages: [stage('ca_nam', 1, null, true)] }, 365)).toEqual([]);
    expect(stageSegments(rice, null)).toEqual([]);
  });
});

describe('seasonDay', () => {
  it('counts the sowing day as day 1', () => {
    expect(seasonDay('2026-10-14', new Date(2026, 9, 14))).toBe(1);
    expect(seasonDay('2026-10-14', new Date(2026, 10, 23))).toBe(41);
    expect(seasonDay('2026-12-01', new Date(2026, 10, 23))).toBeLessThan(1);
  });
});
