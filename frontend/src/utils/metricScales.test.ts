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
    expect(wl.binOf(1.2).label).toBe('1 – 1,5 m');
    expect(wl.binOf(4.4).label).toBe('≥ 2 m');
    expect(METRIC_SCALES.flowRate.binOf(250).label).toBe('≥ 100 m³/s');
  });

  it('lists legend bins from high to low, ending with no data', () => {
    const labels = METRIC_SCALES.waterLevel.bins.map((b) => b.label);
    expect(labels[0]).toBe('≥ 2 m');
    expect(labels[labels.length - 1]).toBe('Chưa có dữ liệu');
  });
});
