import { describe, expect, it } from 'vitest';
import type { Crop, CropStage } from '../api/cropApi';
import { cropsAtThreshold, defaultPreset, presetFor, watchPresets } from './cropThresholds';

const stage = (code: string, name: string, max: number | null, min: number | null = null): CropStage => ({
  code, name, order: 1, durationDays: null, flexible: code !== 'ma', durationSource: null,
  maxSalinity: max, minSalinity: min, thresholdSource: max == null ? null : 'Nguồn', thresholdNote: null,
});
const crop = (code: string, name: string, stages: CropStage[]): Crop => ({
  code, name, category: 'CROP', faoYield: null, faoNote: null, stages,
});

const CROPS = [
  crop('lua', 'Lúa', [stage('ma', 'Mạ', 1), stage('de_nhanh', 'Đẻ nhánh', 4)]),
  crop('sau_rieng', 'Sầu riêng', [stage('ca_nam', 'Cả năm', 0.5)]),
  crop('tom_su', 'Nuôi tôm sú', [stage('ca_vu', 'Cả vụ', 35, 5)]),
  crop('x', 'Chưa có số', [stage('ca_nam', 'Cả năm', null)]),
];

describe('watchPresets', () => {
  it('lists each rice stage, single-stage crops once, ranges for shrimp, and skips stages without a threshold', () => {
    expect(watchPresets(CROPS).map((p) => p.label)).toEqual([
      'Lúa – mạ (1‰)', 'Lúa – đẻ nhánh (4‰)', 'Sầu riêng (0,5‰)', 'Nuôi tôm sú (5–35‰)',
    ]);
    expect(watchPresets(CROPS)[3]).toMatchObject({ crop: 'Nuôi tôm sú', threshold: 35, minThreshold: 5, source: 'Nguồn' });
  });

  it('finds the preset of a saved watch', () => {
    const presets = watchPresets(CROPS);
    expect(presetFor(presets, 'Lúa', 4, null)?.key).toBe('lua:de_nhanh');
    expect(presetFor(presets, 'Lúa', 2.5, null)?.key).toBe('lua:ma');
    expect(presetFor(presets, null, 2, null)).toBeUndefined();
  });

  it('defaults to the main rice stage, not the seedling stage', () => {
    expect(defaultPreset(watchPresets(CROPS))?.key).toBe('lua:de_nhanh');
  });
});

describe('cropsAtThreshold', () => {
  it('names the crops using a threshold', () => {
    expect(cropsAtThreshold(CROPS, 4)).toEqual(['lúa']);
    expect(cropsAtThreshold(CROPS, 2)).toEqual([]);
  });
});
