import { describe, expect, it } from 'vitest';
import type { SalinityForecast } from '../types';
import { storedForecasts, usableForecasts } from './forecastSelection';

const NOW = new Date('2026-10-06T09:00:00');
const f = (forecastDate: string, extra: Partial<SalinityForecast> = {}): SalinityForecast =>
  ({ id: 1, stationId: 1, forecastDate, predictedSalinity: 1, runAt: '2026-10-06T08:00:00+07:00', ...extra });

describe('usableForecasts', () => {
  it('accepts an ST-GNN run from today even though its days start from the last data day', () => {
    const run = [f('2026-09-01', { dataUntil: '2026-08-31' }), f('2026-09-07', { dataUntil: '2026-08-31' })];
    expect(usableForecasts(run, 7, NOW)?.map((x) => x.forecastDate)).toEqual(['2026-09-01', '2026-09-07']);
  });

  it('re-runs when an ST-GNN run does not reach the requested horizon or is from another day', () => {
    const run = [f('2026-09-01', { dataUntil: '2026-08-31' }), f('2026-09-07', { dataUntil: '2026-08-31' })];
    expect(usableForecasts(run, 14, NOW)).toBeNull();
    const yesterday = run.map((x) => ({ ...x, runAt: '2026-10-05T08:00:00+07:00' }));
    expect(usableForecasts(yesterday, 7, NOW)).toBeNull();
  });

  it('keeps the old rule for forecasts that start from today', () => {
    const week = ['07', '08', '09', '10', '11', '12', '13'].map((d) => f(`2026-10-${d}`));
    expect(usableForecasts(week, 7, NOW)).toHaveLength(7);
    expect(usableForecasts(week.slice(1), 6, NOW)).toBeNull();   // ngày đầu không phải ngày mai
    expect(usableForecasts([], 7, NOW)).toBeNull();
  });
});

describe('storedForecasts', () => {
  it('shows past ST-GNN days but drops past days of other models', () => {
    expect(storedForecasts([f('2026-09-01', { dataUntil: '2026-08-31' })], 7, NOW)).toHaveLength(1);
    expect(storedForecasts([f('2026-10-05'), f('2026-10-07')], 7, NOW).map((x) => x.forecastDate)).toEqual(['2026-10-07']);
  });
});
