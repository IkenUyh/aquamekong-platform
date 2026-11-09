import { describe, expect, it } from 'vitest';
import { dryseasonPresets } from './replayApi';

describe('dryseasonPresets', () => {
  it('lists Dec–May seasons newest first, clipped to the data range', () => {
    expect(dryseasonPresets({ minDate: '2021-09-01', maxDate: '2024-03-15' })).toEqual([
      { label: 'Mùa khô 2023–2024', from: '2023-12-01', to: '2024-03-15' },
      { label: 'Mùa khô 2022–2023', from: '2022-12-01', to: '2023-05-31' },
      { label: 'Mùa khô 2021–2022', from: '2021-12-01', to: '2022-05-31' },
    ]);
  });

  it('skips seasons outside the data and handles missing data', () => {
    expect(dryseasonPresets({ minDate: '2024-06-01', maxDate: '2024-08-31' })).toEqual([]);
    expect(dryseasonPresets({ minDate: null, maxDate: null })).toEqual([]);
  });
});
