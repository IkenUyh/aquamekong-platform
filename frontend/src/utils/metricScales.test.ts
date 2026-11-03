import { describe, expect, it } from 'vitest';
import { METRIC_SCALES } from './metricScales';

describe('METRIC_SCALES', () => {
  it('colours salinity with the app-wide scale', () => {
    const s = METRIC_SCALES.salinity;
    expect(s.binOf(0.3).key).toBe('LOW');
    expect(s.binOf(2.5).key).toBe('MEDIUM');
    expect(s.binOf(5).key).toBe('HIGH');
    expect(s.binOf(null).key).toBe('UNKNOWN');
  });

  it('puts water level and flow into ascending bins, lowest range first in the data', () => {
    const wl = METRIC_SCALES.waterLevel;
    expect(wl.binOf(0.2).label).toBe('< 0,5 m');

// TODO: complete edge-case assertions and verification
